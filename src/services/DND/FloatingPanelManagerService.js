import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';

/**
 * Description:
 * A Singleton service to manage the state, position, and z-index of
 * floating PanelGroups within the main container.
 *
 * Properties summary:
 * - _instance {FloatingPanelManagerService} : The singleton instance.
 * - _container {HTMLElement} : The DOM element that floating panels are relative to.
 * - _floatingPanels {Array<PanelGroup>} : Tracks all active floating panels.
 * - _baseZIndex {number} : The starting z-index for floating panels.
 * - _zIndexCounter {number} : The incrementing z-index counter.
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - _boundOnPanelGroupRemoved {Function | null} : Bound handler for group removal event.
 * - _boundOnUndockRequest {Function | null} : Bound handler for undock command event.
 * - _throttledResizeHandler {Function | null} : Throttled handler for window resize events.
 *
 * Typical usage:
 * // In App.js
 * const fpms = FloatingPanelManagerService.getInstance();
 * fpms.registerContainer(containerElement);
 *
 * // In DragDropService (on undock)
 * fpms.addFloatingPanel(panelGroup, 100, 100);
 *
 * // In DND Strategies (on dock)
 * fpms.removeFloatingPanel(panelGroup);
 *
 * Events:
 * - Listens to: EventTypes.PANEL_GROUP_REMOVED
 * - Listens to: EventTypes.APP_UNDOCK_PANEL_REQUEST
 *
 * Business rules implemented:
 * - Manages stacking context (z-index) to ensure active panels are on top.
 * - Constrains floating panels within the boundaries of the registered container.
 * - Handles the conversion of docked panels to floating panels upon request.
 * - Automatically adjusts floating panel positions and sizes when the window is resized.
 *
 * Dependencies:
 * - {import('../../components/Panel/PanelGroup.js').PanelGroup}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../constants/EventTypes.js').EventTypes}
 * - {import('../../utils/ThrottleRAF.js').throttleRAF}
 */
export class FloatingPanelManagerService {
    /**
     * The singleton instance.
     *
     * @type {FloatingPanelManagerService|null}
     * @private
     */
    static _instance = null;

    /**
     * The DOM element that floating panels are relative to (the .container).
     *
     * @type {HTMLElement|null}
     * @private
     */
    _container = null;

    /**
     * Tracks all active floating PanelGroup instances.
     *
     * @type {Array<import('../../components/Panel/PanelGroup.js').PanelGroup>}
     * @private
     */
    _floatingPanels = [];

    /**
     * The starting z-index for floating panels.
     *
     * @type {number}
     * @private
     */
    _baseZIndex = 50;

    /**
     * The incrementing z-index counter to ensure the last-clicked panel is on top.
     *
     * @type {number}
     * @private
     */
    _zIndexCounter = 50;

    /**
     * Unique namespace for appBus listeners.
     *
     * @type {string}
     * @private
     */
    _namespace = 'fpms_service';

    /**
     * Bound handler for group removal event.
     *
     * @type {Function}
     * @private
     */
    _boundOnPanelGroupRemoved;

    /**
     * Bound handler for undock command event.
     *
     * @type {Function}
     * @private
     */
    _boundOnUndockRequest;

    /**
     * Throttled handler for window resize events.
     *
     * @type {Function}
     * @private
     */
    _throttledResizeHandler;

    /**
     * Creates an instance of FloatingPanelManagerService.
     * Private constructor for Singleton.
     */
    constructor() {
        if (FloatingPanelManagerService._instance) {
            console.warn(
                '[FloatingPanelManagerService] Instance already exists. Use getInstance().'
            );
            return FloatingPanelManagerService._instance;
        }
        FloatingPanelManagerService._instance = this;

        const me = this;
        me._zIndexCounter = me._baseZIndex;
        me._boundOnPanelGroupRemoved = me._onPanelGroupRemoved.bind(me);
        me._boundOnUndockRequest = me._onUndockRequest.bind(me);
        me._throttledResizeHandler = throttleRAF(me._onWindowResize.bind(me));

        me._initEventListeners();

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', me._throttledResizeHandler);
        }
    }

    /**
     * Gets the singleton instance.
     *
     * @returns {FloatingPanelManagerService} The singleton instance.
     */
    static getInstance() {
        if (!FloatingPanelManagerService._instance) {
            FloatingPanelManagerService._instance = new FloatingPanelManagerService();
        }
        return FloatingPanelManagerService._instance;
    }

    /**
     * Container setter with validation.
     *
     * @param {HTMLElement} element - The main .container element.
     * @returns {void}
     */
    set container(element) {
        const me = this;
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[FloatingPanelManagerService] invalid container assignment (${element}). Must be an HTMLElement. Keeping previous value: ${me._container}`
            );
            return;
        }
        me._container = element;
    }

    /**
     * Container getter.
     *
     * @returns {HTMLElement|null} The main .container element.
     */
    get container() {
        return this._container;
    }

    /**
     * Destroys all currently active floating panels and clears the manager.
     * This is used when restoring or resetting the workspace to prevent duplicates.
     *
     * @returns {void}
     */
    clearAll() {
        const me = this;
        const panelsToClose = [...me._floatingPanels];
        panelsToClose.forEach(panelGroup => {
            if (panelGroup && typeof panelGroup.destroy === 'function') {
                panelGroup.destroy();
            }
        });

        me._floatingPanels = [];
        me._zIndexCounter = me._baseZIndex;
    }

    /**
     * Registers the main container element used for coordinate calculations
     * and appending floating panels.
     *
     * @param {HTMLElement} containerElement - The main .container element.
     * @returns {void}
     */
    registerContainer(containerElement) {
        this.container = containerElement;
    }

    /**
     * Adds a PanelGroup to the manager, making it floating.
     *
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} panelGroup - The PanelGroup instance.
     * @param {number} x - The initial X coordinate (relative to container).
     * @param {number} y - The initial Y coordinate (relative to container).
     * @returns {void}
     */
    addFloatingPanel(panelGroup, x, y) {
        const me = this;
        if (!me.container) {
            console.error(
                '[FloatingPanelManagerService] addFloatingPanel failed. Container not registered.'
            );
            return;
        }
        if (!panelGroup || typeof panelGroup.setFloatingState !== 'function') {
            console.warn(
                `[FloatingPanelManagerService] invalid panelGroup argument (${panelGroup}). Must be a valid PanelGroup instance.`
            );
            return;
        }

        if (!panelGroup.isMounted) {
            panelGroup.mount(me.container);
        } else if (panelGroup.element.parentNode !== me.container) {
            panelGroup.unmount();
            panelGroup.mount(me.container);
        }

        panelGroup.setFloatingState(true, x, y);

        if (!me._floatingPanels.includes(panelGroup)) {
            me._floatingPanels.push(panelGroup);
        }

        me._normalizeZIndexes();
    }

    /**
     * Removes a PanelGroup from the manager (e.g., when docking).
     *
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} panelGroup - The PanelGroup instance.
     * @returns {void}
     */
    removeFloatingPanel(panelGroup) {
        const me = this;
        if (!panelGroup) {
            return;
        }

        const index = me._floatingPanels.indexOf(panelGroup);
        if (index > -1) {
            me._floatingPanels.splice(index, 1);
        }

        if (typeof panelGroup.setFloatingState === 'function') {
            panelGroup.setFloatingState(false, null, null);
        }

        if (panelGroup.element) {
            panelGroup.element.style.zIndex = '';

            if (panelGroup.isMounted) {
                panelGroup.unmount();
            } else if (panelGroup.element.parentNode === me.container) {
                panelGroup.element.remove();
            }
        }
    }

    /**
     * Handles the drop event for an item being "undocked" (dropped outside a dropzone).
     * Applies constraints to ensure the panel stays within container bounds.
     *
     * @param {object} draggedData - The data from DragDropService { item, type, offsetX, offsetY }.
     * @param {number} positionX - The final clientX of the drop.
     * @param {number} positionY - The final clientY of the drop.
     * @returns {void}
     */
    handleUndockDrop(draggedData, positionX, positionY) {
        const me = this;
        if (!me.container) {
            return;
        }

        const containerRect = me.getContainerBounds();
        if (!containerRect) {
            return;
        }

        const initialX = positionX - containerRect.left - (draggedData.offsetX || 0);
        const initialY = positionY - containerRect.top - (draggedData.offsetY || 0);

        let panelGroup = null;

        if (draggedData.type === 'PanelGroup') {
            panelGroup = draggedData.item;
        } else if (draggedData.type === 'Panel') {
            const panel = draggedData.item;
            const sourceGroup = panel.parentGroup;

            if (sourceGroup && sourceGroup.panels.length === 1) {
                panelGroup = sourceGroup;
            } else if (sourceGroup) {
                sourceGroup.removePanel(panel, true);
                panelGroup = new PanelGroup(panel);
            }
        }

        if (!panelGroup) {
            return;
        }

        if (typeof panelGroup.getColumn === 'function') {
            const col = panelGroup.getColumn();
            if (col) {
                col.removeChild(panelGroup);
            }
        }

        me.addFloatingPanel(panelGroup, initialX, initialY);

        const constrained = me.updatePanelPosition(panelGroup, initialX, initialY, containerRect);

        panelGroup.setFloatingState(true, constrained.x, constrained.y);
    }

    /**
     * Brings a specific floating panel to the top (highest z-index).
     *
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} panelGroup - The panel to bring front.
     * @returns {void}
     */
    bringToFront(panelGroup) {
        const me = this;
        const index = me._floatingPanels.indexOf(panelGroup);

        if (index === -1) {
            return;
        }

        me._floatingPanels.splice(index, 1);
        me._floatingPanels.push(panelGroup);

        me._normalizeZIndexes();
    }

    /**
     * Gets the bounding rectangle of the registered container.
     *
     * @returns {DOMRect|null} The bounds or null if container is not set.
     */
    getContainerBounds() {
        const me = this;
        if (!me.container) {
            return null;
        }
        return me.container.getBoundingClientRect();
    }

    /**
     * Updates a floating panel's position, applying container constraints.
     * Accepts optional override dimensions to calculate constraints based on a future size.
     *
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} panelGroup - The panel to move.
     * @param {number} newX - The desired new X coordinate.
     * @param {number} newY - The desired new Y coordinate.
     * @param {DOMRect} containerBounds - The boundaries of the container.
     * @param {number|null} [overrideWidth=null] - Optional width to use for constraints.
     * @param {number|null} [overrideHeight=null] - Optional height to use for constraints.
     * @returns {{x: number, y: number}} The constrained (applied) coordinates.
     */
    updatePanelPosition(
        panelGroup,
        newX,
        newY,
        containerBounds,
        overrideWidth = null,
        overrideHeight = null
    ) {
        if (!containerBounds || !panelGroup.element) {
            return { x: newX, y: newY };
        }

        const panelElement = panelGroup.element;
        const panelWidth = overrideWidth !== null ? overrideWidth : panelElement.offsetWidth;
        const panelHeight = overrideHeight !== null ? overrideHeight : panelElement.offsetHeight;

        const constrainedX = Math.max(0, Math.min(newX, containerBounds.width - panelWidth));
        const constrainedY = Math.max(0, Math.min(newY, containerBounds.height - panelHeight));

        panelElement.style.left = `${constrainedX}px`;
        panelElement.style.top = `${constrainedY}px`;

        return { x: constrainedX, y: constrainedY };
    }

    /**
     * Serializes the state of all managed floating panels.
     *
     * @returns {Array<object>} An array of serialized PanelGroup data.
     */
    toJSON() {
        const me = this;
        return me._floatingPanels.map(panelGroup => {
            if (typeof panelGroup.toJSON === 'function') {
                return panelGroup.toJSON();
            }
            return null;
        });
    }

    /**
     * Deserializes and restores floating panels from saved data.
     *
     * @param {Array<object>} floatingPanelsData - Data from StateService.
     * @returns {void}
     */
    fromJSON(floatingPanelsData) {
        const me = this;
        if (!Array.isArray(floatingPanelsData)) {
            return;
        }

        floatingPanelsData.forEach(groupData => {
            const panelGroup = new PanelGroup();
            if (typeof panelGroup.fromJSON === 'function') {
                panelGroup.fromJSON(groupData);
            }

            if (panelGroup.isFloating) {
                me.addFloatingPanel(panelGroup, panelGroup.x, panelGroup.y);
            }
        });
    }

    /**
     * Cleans up listeners and service.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        if (me._throttledResizeHandler) {
            me._throttledResizeHandler.cancel();
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', me._throttledResizeHandler);
            }
        }
    }

    /**
     * Initializes appBus event listeners for this component.
     *
     * @private
     * @returns {void}
     */
    _initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };
        appBus.on(EventTypes.PANEL_GROUP_REMOVED, me._boundOnPanelGroupRemoved, options);
        appBus.on(EventTypes.APP_UNDOCK_PANEL_REQUEST, me._boundOnUndockRequest, options);
    }

    /**
     * Event handler for 'app:undock-panel-request' from ContextMenu.
     *
     * @param {object} contextData - The data from the context menu action.
     * @param {import('../../components/Panel/Panel.js').Panel} contextData.panel - The panel to undock.
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} contextData.group - The source group.
     * @param {MouseEvent} contextData.nativeEvent - The original contextmenu event.
     * @private
     * @returns {void}
     */
    _onUndockRequest(contextData) {
        const me = this;
        const { panel, group, nativeEvent } = contextData;
        if (!panel || !group) {
            return;
        }

        const containerRect = me.getContainerBounds();
        if (!containerRect) {
            console.warn('[FloatingPanelManagerService] Container not found for undock request.');
            return;
        }

        const isLastPanel = group.panels.length === 1;
        let panelGroupToFloat;

        if (isLastPanel) {
            panelGroupToFloat = group;
            const sourceColumn = panelGroupToFloat.getColumn();
            if (sourceColumn) {
                sourceColumn.removeChild(panelGroupToFloat, true);
            }
        } else {
            group.removePanel(panel, true);
            panelGroupToFloat = new PanelGroup(panel);
        }

        const x = nativeEvent.clientX - containerRect.left;
        const y = nativeEvent.clientY - containerRect.top;

        me.addFloatingPanel(panelGroupToFloat, x, y);
        const constrained = me.updatePanelPosition(panelGroupToFloat, x, y, containerRect);
        panelGroupToFloat.setFloatingState(true, constrained.x, constrained.y);
    }

    /**
     * Event handler for when any PanelGroup is removed from the layout.
     *
     * @param {object} eventData - The event payload containing panel reference.
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} eventData.panel - The PanelGroup instance being removed.
     * @private
     * @returns {void}
     */
    _onPanelGroupRemoved({ panel }) {
        const me = this;
        if (me._floatingPanels.includes(panel)) {
            me.removeFloatingPanel(panel);
        }
    }

    /**
     * Normalizes the z-indexes of all floating panels to avoid infinite growth.
     * Reassigns sequential z-indexes starting from baseZIndex based on the
     * current order in the _floatingPanels array.
     *
     * @private
     * @returns {void}
     */
    _normalizeZIndexes() {
        const me = this;
        me._floatingPanels.forEach((panel, index) => {
            const newZ = me._baseZIndex + index;
            if (panel.element) {
                panel.element.style.zIndex = newZ;
            }
        });
        me._zIndexCounter = me._baseZIndex + me._floatingPanels.length;
    }

    /**
     * Handles window resize events to constrain and resize all floating panels.
     * Adjusts the position and dimensions of panels to ensure they remain
     * entirely within the container view.
     *
     * @private
     * @returns {void}
     */
    _onWindowResize() {
        const me = this;
        const containerBounds = me.getContainerBounds();
        if (!containerBounds) return;

        me._floatingPanels.forEach(panelGroup => {
            if (panelGroup.isFloating && !panelGroup.isMaximized) {
                let currentWidth = panelGroup.width;
                let currentHeight = panelGroup.height;

                if ((!currentWidth || !currentHeight) && panelGroup.element) {
                    currentWidth = panelGroup.element.offsetWidth;
                    currentHeight = panelGroup.element.offsetHeight;
                }

                currentWidth = currentWidth || 0;
                currentHeight = currentHeight || 0;

                let newWidth = currentWidth;
                let newHeight = currentHeight;

                if (newWidth > containerBounds.width) {
                    newWidth = containerBounds.width;
                }
                if (newHeight > containerBounds.height) {
                    newHeight = containerBounds.height;
                }

                panelGroup.width = newWidth;
                panelGroup.height = newHeight;

                const currentX = panelGroup.x;
                const currentY = panelGroup.y;

                const constrained = me.updatePanelPosition(
                    panelGroup,
                    currentX,
                    currentY,
                    containerBounds,
                    newWidth,
                    newHeight
                );

                panelGroup.setFloatingState(true, constrained.x, constrained.y);
            }
        });
    }
}
