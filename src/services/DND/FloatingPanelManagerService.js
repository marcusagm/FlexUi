import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { appBus } from '../../utils/EventBus.js';

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
 * - Listens to: 'panelgroup:removed'
 * - Listens to: 'app:undock-panel-request'
 *
 * Dependencies:
 * - components/Panel/PanelGroup.js
 * - utils/EventBus.js
 */
export class FloatingPanelManagerService {
    /**
     * The singleton instance.
     * @type {FloatingPanelManagerService|null}
     * @private
     */
    static _instance = null;

    /**
     * The DOM element that floating panels are relative to (the .container).
     * @type {HTMLElement|null}
     * @private
     */
    _container = null;

    /**
     * Tracks all active floating PanelGroup instances.
     * @type {Array<import('../../components/Panel/PanelGroup.js').PanelGroup>}
     * @private
     */
    _floatingPanels = [];

    /**
     * The starting z-index for floating panels.
     * @type {number}
     * @private
     */
    _baseZIndex = 50;

    /**
     * The incrementing z-index counter to ensure the last-clicked panel is on top.
     * @type {number}
     * @private
     */
    _zIndexCounter = 100;

    /**
     * Unique namespace for appBus listeners.
     * @type {string}
     * @private
     */
    _namespace = 'fpms_service';

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnPanelGroupRemoved = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnUndockRequest = null;

    /**
     * Private constructor for Singleton.
     */
    constructor() {
        if (FloatingPanelManagerService._instance) {
            console.warn('FloatingPanelManagerService is a singleton. Use getInstance().');
            return FloatingPanelManagerService._instance;
        }
        FloatingPanelManagerService._instance = this;

        const me = this;
        me._boundOnPanelGroupRemoved = me._onPanelGroupRemoved.bind(me);
        me._boundOnUndockRequest = me._onUndockRequest.bind(me);
        me._initEventListeners();
    }

    /**
     * Gets the singleton instance.
     * @returns {FloatingPanelManagerService} The singleton instance.
     */
    static getInstance() {
        if (!FloatingPanelManagerService._instance) {
            FloatingPanelManagerService._instance = new FloatingPanelManagerService();
        }
        return FloatingPanelManagerService._instance;
    }

    /**
     * <Container> setter.
     * @param {HTMLElement} element - The main .container element.
     * @returns {void}
     */
    set container(element) {
        if (!(element instanceof HTMLElement)) {
            console.warn(
                'FloatingPanelManagerService: Invalid container provided. Must be an HTMLElement.'
            );
            this._container = null;
            return;
        }
        this._container = element;
    }

    /**
     * <Container> getter.
     * @returns {HTMLElement|null} The main .container element.
     */
    get container() {
        return this._container;
    }

    /* ----------------------
     Public Methods
    ---------------------- */

    /**
     * Description:
     * Destroys all currently active floating panels and clears the manager.
     * This is used when restoring or resetting the workspace to prevent duplicates.
     *
     * @returns {void}
     */
    clearAll() {
        const me = this;
        const panelsToClose = [...me._floatingPanels];
        panelsToClose.forEach(panelGroup => {
            if (panelGroup && typeof panelGroup.close === 'function') {
                panelGroup.close();
            }
        });

        me._floatingPanels = [];
        me._zIndexCounter = 100;
    }

    /**
     * Initializes appBus event listeners for this component.
     * @private
     * @returns {void}
     */
    _initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };
        appBus.on('panelgroup:removed', me._boundOnPanelGroupRemoved, options);
        appBus.on('app:undock-panel-request', me._boundOnUndockRequest, options);
    }

    /**
     * Cleans up appBus listeners.
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);
    }

    /**
     * Registers the main container element used for coordinate calculations
     * and appending floating panels.
     * @param {HTMLElement} containerElement - The main .container element.
     * @returns {void}
     */
    registerContainer(containerElement) {
        this.container = containerElement;
    }

    /**
     * Adds a PanelGroup to the manager, making it floating.
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} panelGroup - The PanelGroup instance.
     * @param {number} x - The initial X coordinate (relative to container).
     * @param {number} y - The initial Y coordinate (relative to container).
     * @returns {void}
     */
    addFloatingPanel(panelGroup, x, y) {
        const me = this;
        if (!me.container) {
            console.error('FloatingPanelManagerService: Container not registered.');
            return;
        }
        if (!panelGroup || typeof panelGroup.setFloatingState !== 'function') {
            console.warn(
                'FloatingPanelManagerService: Invalid panelGroup passed to addFloatingPanel.'
            );
            return;
        }

        me.container.appendChild(panelGroup.element);
        panelGroup.setFloatingState(true, x, y);
        panelGroup.element.style.zIndex = me._zIndexCounter++;

        if (!me._floatingPanels.includes(panelGroup)) {
            me._floatingPanels.push(panelGroup);
        }
    }

    /**
     * Removes a PanelGroup from the manager (e.g., when docking).
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

        panelGroup.setFloatingState(false, null, null);
        panelGroup.element.style.zIndex = '';
        panelGroup.element.remove();
    }

    /**
     * Handles the drop event for an item being "undocked" (dropped outside a dropzone).
     * @param {object} draggedData - The data from DragDropService.
     * @param {number} positionX - The final clientX of the drop.
     * @param {number} positionY - The final clientY of the drop.
     * @returns {void}
     */
    handleUndockDrop(draggedData, positionX, positionY) {
        const me = this;
        if (!me.container) {
            return;
        }

        const containerRect = me.container.getBoundingClientRect();
        const x = positionX - containerRect.left;
        const y = positionY - containerRect.top;

        let panelGroup = null;

        if (draggedData.type === 'PanelGroup') {
            panelGroup = draggedData.item;
        } else if (draggedData.type === 'Panel') {
            const panel = draggedData.item;
            const sourceGroup = panel._state.parentGroup;

            if (sourceGroup._state.panels.length === 1) {
                panelGroup = sourceGroup;
            } else {
                sourceGroup.removePanel(panel, true);
                panelGroup = new PanelGroup(panel);
            }
        }

        if (!panelGroup) {
            return;
        }

        panelGroup.getColumn()?.removePanelGroup(panelGroup);
        me.addFloatingPanel(panelGroup, x, y);
    }

    /**
     * Event handler for 'app:undock-panel-request' from ContextMenu.
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
            console.warn('FPMS: Container not found for undock request.');
            return;
        }

        const isLastPanel = group._state.panels.length === 1;
        let panelGroupToFloat;

        if (isLastPanel) {
            panelGroupToFloat = group;
            const sourceColumn = panelGroupToFloat.getColumn();
            if (sourceColumn) {
                sourceColumn.removePanelGroup(panelGroupToFloat, true);
            }
        } else {
            group.removePanel(panel, true);
            panelGroupToFloat = new PanelGroup(panel);
        }

        const x = nativeEvent.clientX - containerRect.left - 10;
        const y = nativeEvent.clientY - containerRect.top - 10;

        me.addFloatingPanel(panelGroupToFloat, x, y);
    }

    /**
     * Event handler for when any PanelGroup is removed from the layout.
     * @param {object} eventData
     * @param {PanelGroup} eventData.panel - The PanelGroup instance being removed.
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
     * Brings a specific floating panel to the top (highest z-index).
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

        panelGroup.element.style.zIndex = me._zIndexCounter++;
    }

    /**
     * Gets the bounding rectangle of the registered container.
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
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} panelGroup - The panel to move.
     * @param {number} newX - The desired new X coordinate.
     * @param {number} newY - The desired new Y coordinate.
     * @returns {{x: number, y: number}} The constrained (applied) coordinates.
     */
    updatePanelPosition(panelGroup, newX, newY) {
        const me = this;
        const bounds = me.getContainerBounds();
        if (!bounds) {
            return { x: newX, y: newY };
        }

        const panelElement = panelGroup.element;
        const panelWidth = panelElement.offsetWidth;
        const panelHeight = panelElement.offsetHeight;

        const constrainedX = Math.max(0, Math.min(newX, bounds.width - panelWidth));
        const constrainedY = Math.max(0, Math.min(newY, bounds.height - panelHeight));

        panelElement.style.left = `${constrainedX}px`;
        panelElement.style.top = `${constrainedY}px`;

        return { x: constrainedX, y: constrainedY };
    }

    /**
     * Serializes the state of all managed floating panels.
     * @returns {Array<object>} An array of serialized PanelGroup data.
     */
    toJSON() {
        const me = this;
        return me._floatingPanels.map(panelGroup => panelGroup.toJSON());
    }

    /**
     * Deserializes and restores floating panels from saved data.
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
            panelGroup.fromJSON(groupData);

            if (panelGroup._state.isFloating) {
                me.addFloatingPanel(panelGroup, panelGroup._state.x, panelGroup._state.y);
            }
        });
    }
}
