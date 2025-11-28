import { PopoutWindow } from '../core/PopoutWindow.js';
import { FloatingPanelManagerService } from './DND/FloatingPanelManagerService.js';
import { appNotifications } from './Notification/Notification.js';

/**
 * Description:
 * A Singleton service responsible for managing external "popout" windows.
 * It handles the lifecycle of extracting a PanelGroup or ApplicationWindow from the main application
 * into a native browser window and returning it back to the main application.
 *
 * Properties summary:
 * - _instance {PopoutManagerService|null} : The singleton instance.
 * - _activePopouts {Map<string, PopoutWindow>} : Maps IDs (group or window) to their PopoutWindow instances.
 * - _groupInstances {Map<string, PanelGroup>} : Maps IDs to PanelGroup instances.
 * - _windowInstances {Map<string, ApplicationWindow>} : Maps IDs to ApplicationWindow instances.
 * - _viewportReferences {Map<string, Viewport>} : Maps Window IDs to their original Viewport instances.
 * - _styleObserver {MutationObserver|null} : Observer to monitor style changes in the main document.
 *
 * Typical usage:
 * const popoutService = PopoutManagerService.getInstance();
 * popoutService.popoutGroup(myPanelGroup);
 * popoutService.popoutWindow(myAppWindow);
 *
 * Events:
 * - Listens to window 'beforeunload' to cleanup external windows.
 *
 * Business rules implemented:
 * - Ensures an element is only popped out once.
 * - Manages DOM transplantation.
 * - Handles "return" logic for both Groups and Windows.
 * - Sincronizes ApplicationWindow geometry with the native window size/position.
 * - Supports serialization of external window states.
 * - Implements sequential restoration with fallback for popup blockers.
 * - Automatically closes all popouts when the main window is closed/reloaded.
 * - Synchronizes dynamic CSS changes (lazy loading) to all active popouts.
 *
 * Dependencies:
 * - {import('../core/PopoutWindow.js').PopoutWindow}
 * - {import('./DND/FloatingPanelManagerService.js').FloatingPanelManagerService}
 * - {import('./Notification/Notification.js').appNotifications}
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
     * Maps component IDs to their active PopoutWindow instances.
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
     * Keeps track of the ApplicationWindow instances associated with popouts.
     *
     * @type {Map<string, import('../components/Viewport/ApplicationWindow.js').ApplicationWindow>}
     * @private
     */
    _windowInstances = new Map();

    /**
     * Stores the original Viewport of a popped out window to enable return.
     *
     * @type {Map<string, import('../components/Viewport/Viewport.js').Viewport>}
     * @private
     */
    _viewportReferences = new Map();

    /**
     * Observer to monitor style changes in the main document.
     *
     * @type {MutationObserver|null}
     * @private
     */
    _styleObserver = null;

    /**
     * Private constructor for Singleton.
     */
    constructor() {
        if (PopoutManagerService._instance) {
            console.warn('[PopoutManagerService] Instance already exists. Use getInstance().');
            return PopoutManagerService._instance;
        }
        PopoutManagerService._instance = this;

        const me = this;
        window.addEventListener('beforeunload', () => {
            me.closeAll();
        });
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

        me._startStyleObserver();

        if (panelGroup.isFloating) {
            FloatingPanelManagerService.getInstance().removeFloatingPanel(panelGroup);
        } else {
            const column = panelGroup.getColumn();
            if (column) {
                column.removeChild(panelGroup, true);
            }
        }

        const width = geometry?.width || panelGroup.width || 400;
        const height = geometry?.height || panelGroup.height || 300;
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
            }

            if (popout.nativeWindow && popout.nativeWindow.document) {
                panelGroup.mount(popout.nativeWindow.document.body);
            }

            if (typeof panelGroup.requestLayoutUpdate === 'function') {
                panelGroup.requestLayoutUpdate();
            }
        } catch (error) {
            me._onDidOpenPopoutWindowFail(panelGroup, 'PanelGroup', error);
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

        if (me._activePopouts.size === 0) {
            me._stopStyleObserver();
        }

        if (typeof panelGroup.setPopoutMode === 'function') {
            panelGroup.setPopoutMode(false);
        }

        const fpms = FloatingPanelManagerService.getInstance();
        const containerBounds = fpms.getContainerBounds();

        let targetX = 50;
        let targetY = 50;

        if (containerBounds) {
            targetX = (containerBounds.width - (panelGroup.width || 300)) / 2;
            targetY = (containerBounds.height - (panelGroup.height || 200)) / 2;
        }

        fpms.addFloatingPanel(panelGroup, targetX, targetY);

        if (typeof panelGroup.updateHeight === 'function') {
            panelGroup.updateHeight();
        }
    }

    /**
     * Moves an ApplicationWindow from the Viewport to a new external window.
     *
     * @param {import('../components/Viewport/ApplicationWindow.js').ApplicationWindow} appWindow - The window to pop out.
     * @param {object} [geometry=null] - Optional geometry override.
     * @returns {Promise<void>}
     */
    async popoutWindow(appWindow, geometry = null) {
        const me = this;

        if (!appWindow || typeof appWindow !== 'object') {
            console.warn(`[PopoutManagerService] invalid appWindow assignment (${appWindow}).`);
            return;
        }

        if (me._activePopouts.has(appWindow.id)) {
            console.warn(`[PopoutManagerService] Window "${appWindow.id}" is already in a popout.`);
            return;
        }

        me._startStyleObserver();

        let viewportInstance = null;
        if (appWindow.element) {
            const viewportElement = appWindow.element.closest('.viewport');
            viewportInstance = viewportElement ? viewportElement.dropZoneInstance : null;
        }

        if (!viewportInstance) {
            console.warn('[PopoutManagerService] Could not find parent Viewport for window.');
        }

        if (viewportInstance) {
            me._viewportReferences.set(appWindow.id, viewportInstance);
            if (appWindow.isMounted) {
                appWindow.unmount();
            }
        }

        const width = geometry?.width || appWindow.width || 800;
        const height = geometry?.height || appWindow.height || 600;
        const left = geometry?.x;
        const top = geometry?.y;
        const title = appWindow.title || 'Application Window';

        const popout = new PopoutWindow(`popout-win-${appWindow.id}`, {
            title: title,
            width: width,
            height: height,
            left: left,
            top: top
        });

        popout.onClose = () => {
            me.returnWindow(appWindow);
        };

        me._activePopouts.set(appWindow.id, popout);
        me._windowInstances.set(appWindow.id, appWindow);

        try {
            await popout.open();

            if (appWindow.element) {
                popout.appendChild(appWindow.element);
            }

            if (typeof appWindow.setPopoutMode === 'function') {
                appWindow.setPopoutMode(true);
            }

            if (popout.nativeWindow && popout.nativeWindow.document) {
                appWindow.mount(popout.nativeWindow.document.body);
            }

            const nativeWin = popout.nativeWindow;
            const syncHandler = () => {
                appWindow.width = nativeWin.innerWidth;
                appWindow.height = nativeWin.innerHeight;
                appWindow.x = nativeWin.screenX;
                appWindow.y = nativeWin.screenY;
            };
            nativeWin.addEventListener('resize', syncHandler);
            nativeWin.addEventListener('move', syncHandler);
        } catch (error) {
            me._onDidOpenPopoutWindowFail(appWindow, 'ApplicationWindow', error);
        }
    }

    /**
     * Returns a popped-out ApplicationWindow back to its original Viewport.
     * Position Logic: x=0, y=0 (if no tabbar) or y=tabBarHeight (if tabbar visible).
     *
     * @param {import('../components/Viewport/ApplicationWindow.js').ApplicationWindow} appWindow - The window to return.
     * @returns {void}
     */
    returnWindow(appWindow) {
        const me = this;

        if (!appWindow || !me._activePopouts.has(appWindow.id)) {
            return;
        }

        const popout = me._activePopouts.get(appWindow.id);
        const viewport = me._viewportReferences.get(appWindow.id);

        if (appWindow.isMounted) {
            appWindow.unmount();
        }

        if (popout) {
            popout.onClose = null;
            popout.close();
            popout.dispose();
        }

        me._activePopouts.delete(appWindow.id);
        me._windowInstances.delete(appWindow.id);
        me._viewportReferences.delete(appWindow.id);

        if (me._activePopouts.size === 0) {
            me._stopStyleObserver();
        }

        if (typeof appWindow.setPopoutMode === 'function') {
            appWindow.setPopoutMode(false);
        }

        if (viewport) {
            appWindow.x = 0;

            const tabBar = viewport.tabBar;
            if (tabBar && tabBar.offsetHeight > 0) {
                appWindow.y = tabBar.offsetHeight;
            } else {
                appWindow.y = 0;
            }

            viewport.addWindow(appWindow);
        }
    }

    /**
     * Restores a list of popout items sequentially to avoid browser blocking.
     * This method encapsulates the delay logic and error handling.
     *
     * @param {Array<{item: object, geometry: object, type: string}>} items - List of items to restore.
     * @returns {Promise<void>}
     */
    async restorePopouts(items) {
        const me = this;
        if (!Array.isArray(items) || items.length === 0) return;

        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        for (const record of items) {
            const { item, geometry, type } = record;

            if (type === 'ApplicationWindow') {
                await me.popoutWindow(item, geometry);
            } else {
                await me.popoutGroup(item, geometry);
            }

            await delay(300);
        }
    }

    /**
     * Closes all active popout windows.
     * Intended for application shutdown or reload scenarios.
     *
     * @returns {void}
     */
    closeAll() {
        const me = this;
        me._activePopouts.forEach(popout => {
            if (popout) {
                popout.onClose = null;
                popout.close();
                popout.dispose();
            }
        });
        me._activePopouts.clear();
        me._groupInstances.clear();
        me._windowInstances.clear();
        me._viewportReferences.clear();
        me._stopStyleObserver();
    }

    /**
     * Closes the popout window associated with a group and cleans up the registry.
     *
     * @param {object} item - The item (group or window) being closed.
     * @returns {void}
     */
    closePopout(item) {
        const me = this;
        if (!item || !me._activePopouts.has(item.id)) {
            return;
        }

        const popout = me._activePopouts.get(item.id);

        if (item.isMounted) {
            item.unmount();
        }

        if (popout) {
            popout.onClose = null;
            popout.close();
            popout.dispose();
        }

        me._activePopouts.delete(item.id);
        me._groupInstances.delete(item.id);
        me._windowInstances.delete(item.id);
        me._viewportReferences.delete(item.id);

        if (me._activePopouts.size === 0) {
            me._stopStyleObserver();
        }
    }

    /**
     * Retrieves the active popout window for a given group or window.
     *
     * @param {object} item - The panel group or application window.
     * @returns {import('../core/PopoutWindow.js').PopoutWindow | undefined} The popout instance.
     */
    getPopoutFor(item) {
        const me = this;
        if (!item) return undefined;
        return me._activePopouts.get(item.id);
    }

    /**
     * Compatibility alias for getPopoutFor.
     *
     * @param {import('../components/Panel/PanelGroup.js').PanelGroup} group
     * @returns {import('../core/PopoutWindow.js').PopoutWindow | undefined}
     */
    getPopoutForGroup(group) {
        return this.getPopoutFor(group);
    }

    /**
     * Retrieves serialization data for all currently active popouts.
     * Used by the ApplicationStateService to persist external windows.
     *
     * @returns {Array<object>} An array of popout states.
     */
    getOpenPopouts() {
        const me = this;
        const result = [];

        me._activePopouts.forEach((popout, id) => {
            let data = null;
            let type = null;

            const group = me._groupInstances.get(id);
            if (group) {
                data = typeof group.toJSON === 'function' ? group.toJSON() : null;
                type = 'PanelGroup';
            }

            const win = me._windowInstances.get(id);
            if (win) {
                data = typeof win.toJSON === 'function' ? win.toJSON() : null;
                type = 'ApplicationWindow';
            }

            if (popout.nativeWindow && data) {
                const geometry = {
                    x: popout.nativeWindow.screenX,
                    y: popout.nativeWindow.screenY,
                    width: popout.nativeWindow.outerWidth,
                    height: popout.nativeWindow.outerHeight
                };

                result.push({
                    id: id,
                    type: type,
                    geometry: geometry,
                    data: data
                });
            }
        });

        return result;
    }

    /**
     * Handles failure when opening a popout (e.g., Popup Blocker).
     * Reverts the item to a floating state in the main window and notifies the user.
     *
     * @param {object} item - The item that failed to pop out.
     * @param {string} type - The type of the item ('PanelGroup' or 'ApplicationWindow').
     * @param {Error} error - The error object.
     * @private
     * @returns {void}
     */
    _onDidOpenPopoutWindowFail(item, type, error) {
        const me = this;
        console.warn(
            `[PopoutManagerService] Failed to open ${type} popout. Reverting to floating.`,
            error
        );

        appNotifications.warning(
            'Popout blocked by browser settings. The window has been docked back to the main workspace.'
        );

        if (type === 'ApplicationWindow') {
            me.returnWindow(item);
        } else {
            me.returnGroup(item);
        }
    }

    /**
     * Starts the MutationObserver to monitor style injections in the main document.
     *
     * @private
     * @returns {void}
     */
    _startStyleObserver() {
        const me = this;
        if (me._styleObserver) {
            return;
        }

        me._styleObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (
                            node.nodeName === 'STYLE' ||
                            (node.nodeName === 'LINK' && node.getAttribute('rel') === 'stylesheet')
                        ) {
                            me._syncStyleToPopouts(node);
                        }
                    });
                }
            });
        });

        me._styleObserver.observe(document.head, { childList: true });
    }

    /**
     * Stops the MutationObserver if active.
     *
     * @private
     * @returns {void}
     */
    _stopStyleObserver() {
        const me = this;
        if (me._styleObserver) {
            me._styleObserver.disconnect();
            me._styleObserver = null;
        }
    }

    /**
     * Clones and injects a style node into all active popout windows.
     *
     * @param {Node} node - The style or link node to sync.
     * @private
     * @returns {void}
     */
    _syncStyleToPopouts(node) {
        const me = this;
        me._activePopouts.forEach(popout => {
            if (popout.nativeWindow && popout.nativeWindow.document) {
                try {
                    const clone = node.cloneNode(true);
                    popout.nativeWindow.document.head.appendChild(clone);
                } catch (e) {
                    console.warn('[PopoutManagerService] Failed to sync style to popout.', e);
                }
            }
        });
    }
}
