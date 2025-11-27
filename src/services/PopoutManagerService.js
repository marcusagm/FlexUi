import { PopoutWindow } from '../core/PopoutWindow.js';
import { FloatingPanelManagerService } from './DND/FloatingPanelManagerService.js';

/**
 * Description:
 * A Singleton service responsible for managing external "popout" windows.
 * It handles the lifecycle of extracting a PanelGroup from the main application
 * into a native browser window and returning it back to the main application.
 *
 * Properties summary:
 * - _instance {PopoutManagerService|null} : The singleton instance.
 * - _activePopouts {Map<string, PopoutWindow>} : Maps PanelGroup IDs to their PopoutWindow instances.
 * - _groupInstances {Map<string, PanelGroup>} : Maps IDs to the PanelGroup instances (for retrieval).
 *
 * Typical usage:
 * const popoutService = PopoutManagerService.getInstance();
 * popoutService.popoutGroup(myPanelGroup);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Ensures a PanelGroup is only popped out once.
 * - Manages the complex DOM transplantation between windows.
 * - Handles the "return" logic when the external window is closed.
 * - Converts the group to a floating panel upon return to the main window.
 * - Supports serialization of external window states for persistence.
 *
 * Dependencies:
 * - {import('../core/PopoutWindow.js').PopoutWindow}
 * - {import('./DND/FloatingPanelManagerService.js').FloatingPanelManagerService}
 */
export class PopoutManagerService {
    /**
     * The private static instance.
     *
     * @type {PopoutManagerService|null}
     * @private
     */
    static _instance = null;

    /**
     * Maps PanelGroup IDs to their active PopoutWindow instances.
     *
     * @type {Map<string, import('../core/PopoutWindow.js').PopoutWindow>}
     * @private
     */
    _activePopouts = new Map();

    /**
     * Keeps track of the PanelGroup instances associated with popouts.
     *
     * @type {Map<string, import('../components/Panel/PanelGroup.js').PanelGroup>}
     * @private
     */
    _groupInstances = new Map();

    /**
     * Creates an instance of PopoutManagerService.
     * Private constructor for Singleton.
     */
    constructor() {
        if (PopoutManagerService._instance) {
            console.warn('[PopoutManagerService] Instance already exists. Use getInstance().');
            return PopoutManagerService._instance;
        }
        PopoutManagerService._instance = this;
    }

    /**
     * Gets the singleton instance.
     *
     * @returns {PopoutManagerService} The singleton instance.
     */
    static getInstance() {
        if (!PopoutManagerService._instance) {
            PopoutManagerService._instance = new PopoutManagerService();
        }
        return PopoutManagerService._instance;
    }

    /**
     * Moves a PanelGroup from the main application to a new external window.
     *
     * @param {import('../components/Panel/PanelGroup.js').PanelGroup} panelGroup - The group to pop out.
     * @param {object} [geometry=null] - Optional override for window geometry {x, y, width, height}.
     * @returns {Promise<void>} Resolves when the popout is fully opened and populated.
     */
    async popoutGroup(panelGroup, geometry = null) {
        const me = this;

        if (!panelGroup || typeof panelGroup !== 'object') {
            console.warn(
                `[PopoutManagerService] invalid panelGroup assignment (${panelGroup}). Must be a PanelGroup instance.`
            );
            return;
        }

        if (me._activePopouts.has(panelGroup.id)) {
            console.warn(
                `[PopoutManagerService] Group "${panelGroup.id}" is already in a popout window.`
            );
            return;
        }

        if (panelGroup.isFloating) {
            FloatingPanelManagerService.getInstance().removeFloatingPanel(panelGroup);
        } else {
            const column = panelGroup.getColumn();
            if (column) {
                column.removeChild(panelGroup, true);
            }
        }

        const defaultWidth = 400;
        const defaultHeight = 300;

        const width = geometry?.width || panelGroup.width || defaultWidth;
        const height = geometry?.height || panelGroup.height || defaultHeight;
        const left = geometry?.x;
        const top = geometry?.y;
        const title = panelGroup.title || 'External Panel';

        const popout = new PopoutWindow(`popout-${panelGroup.id}`, {
            title: title,
            width: width,
            height: height,
            left: left,
            top: top
        });

        popout.onClose = () => {
            me.returnGroup(panelGroup);
        };

        me._activePopouts.set(panelGroup.id, popout);
        me._groupInstances.set(panelGroup.id, panelGroup);

        try {
            await popout.open();

            if (panelGroup.element) {
                popout.appendChild(panelGroup.element);
            }

            if (typeof panelGroup.setPopoutMode === 'function') {
                panelGroup.setPopoutMode(true);
            } else if (panelGroup.element) {
                panelGroup.element.style.width = '100%';
                panelGroup.element.style.height = '100%';
                panelGroup.element.style.position = 'static';
            }

            if (popout.nativeWindow && popout.nativeWindow.document) {
                panelGroup.mount(popout.nativeWindow.document.body);
            }

            if (typeof panelGroup.requestLayoutUpdate === 'function') {
                panelGroup.requestLayoutUpdate();
            }
        } catch (error) {
            console.error('[PopoutManagerService] Failed to open popout window.', error);
            me.returnGroup(panelGroup);
        }
    }

    /**
     * Returns a popped-out PanelGroup back to the main application.
     * Defaults to adding it as a floating panel in the center of the screen.
     *
     * @param {import('../components/Panel/PanelGroup.js').PanelGroup} panelGroup - The group to return.
     * @returns {void}
     */
    returnGroup(panelGroup) {
        const me = this;

        if (!panelGroup || !me._activePopouts.has(panelGroup.id)) {
            return;
        }

        const popout = me._activePopouts.get(panelGroup.id);

        if (panelGroup.isMounted) {
            panelGroup.unmount();
        }

        if (popout) {
            popout.onClose = null;
            popout.close();
            popout.dispose();
        }
        me._activePopouts.delete(panelGroup.id);
        me._groupInstances.delete(panelGroup.id);

        if (typeof panelGroup.setPopoutMode === 'function') {
            panelGroup.setPopoutMode(false);
        }

        const fpms = FloatingPanelManagerService.getInstance();
        const containerBounds = fpms.getContainerBounds();

        let targetX = 50;
        let targetY = 50;
        const defaultHeight = 200;
        const defaultWidth = 300;

        if (containerBounds) {
            targetX = (containerBounds.width - (panelGroup.width || defaultWidth)) / 2;
            targetY = (containerBounds.height - (panelGroup.height || defaultHeight)) / 2;
        }

        fpms.addFloatingPanel(panelGroup, targetX, targetY);

        if (typeof panelGroup.updateHeight === 'function') {
            panelGroup.updateHeight();
        }
    }

    /**
     * Closes the popout window associated with a group and cleans up the registry.
     * DOES NOT handle DOM movement or state restoration of the group.
     * This is used when Drag-and-Drop handles the movement logic (e.g. docking).
     *
     * @param {import('../components/Panel/PanelGroup.js').PanelGroup} panelGroup - The group being closed.
     * @returns {void}
     */
    closePopout(panelGroup) {
        const me = this;
        if (!panelGroup || !me._activePopouts.has(panelGroup.id)) {
            return;
        }

        const popout = me._activePopouts.get(panelGroup.id);

        if (panelGroup.isMounted) {
            panelGroup.unmount();
        }

        if (popout) {
            popout.onClose = null;
            popout.close();
            popout.dispose();
        }

        me._activePopouts.delete(panelGroup.id);
        me._groupInstances.delete(panelGroup.id);
    }

    /**
     * Retrieves the active popout window for a given group.
     *
     * @param {import('../components/Panel/PanelGroup.js').PanelGroup} group - The panel group.
     * @returns {import('../core/PopoutWindow.js').PopoutWindow | undefined} The popout instance.
     */
    getPopoutForGroup(group) {
        const me = this;
        if (!group) return undefined;
        return me._activePopouts.get(group.id);
    }

    /**
     * Retrieves serialization data for all currently active popouts.
     * Used by the ApplicationStateService to persist external windows.
     *
     * @returns {Array<object>} An array of popout states { id, geometry, groupData }.
     */
    getOpenPopouts() {
        const me = this;
        const result = [];

        me._activePopouts.forEach((popout, groupId) => {
            const group = me._groupInstances.get(groupId);
            if (popout.nativeWindow && group) {
                const groupData = typeof group.toJSON === 'function' ? group.toJSON() : null;

                const geometry = {
                    x: popout.nativeWindow.screenX,
                    y: popout.nativeWindow.screenY,
                    width: popout.nativeWindow.outerWidth,
                    height: popout.nativeWindow.outerHeight
                };

                result.push({
                    id: groupId,
                    geometry: geometry,
                    groupData: groupData
                });
            }
        });

        return result;
    }
}
