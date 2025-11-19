import { PanelGroupHeader } from './PanelGroupHeader.js';
import { PanelFactory } from './PanelFactory.js';
import { Panel } from './Panel.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';
import { FloatingPanelManagerService } from '../../services/DND/FloatingPanelManagerService.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { ItemType, DropZoneType } from '../../constants/DNDTypes.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Manages a group of Panel (tabs) within a Column. This class acts as an
 * "Orchestrator" for its child Panel components. It manages the active tab state,
 * collapse state, and its own dimensions.
 *
 * This component implements **hybrid resizing**:
 * 1. **Docked**: Uses ResizeHandleManager with handles: ['s'] for vertical resizing only.
 * 2. **Floating**: Uses ResizeHandleManager with handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
 * for full 8-directional resizing, applying strict container clamping via the FloatingPanelManagerService.
 *
 * Properties summary:
 * - id {string} : Unique ID for this instance (also used as namespace).
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - _throttledUpdate {Function | null} : The throttled function for height updates (docked only).
 * - _state {object} : Internal state (child Panels, layout, parent Column, dimensions).
 * - element {HTMLElement} : The main DOM element (<div class="panel-group">).
 * - _resizeHandleManager {ResizeHandleManager | null} : Manages all resize handles (docked or floating).
 *
 * Typical usage:
 * // In Column.js
 * const panel = new TextPanel(...);
 * const panelGroup = new PanelGroup(panel);
 * column.addPanelGroup(panelGroup);
 *
 * Events:
 * - Listens to: EventTypes.PANEL_GROUP_CHILD_CLOSE, EventTypes.APP_CLOSE_PANEL_REQUEST, EventTypes.PANEL_CLOSE_REQUEST, EventTypes.PANEL_TOGGLE_COLLAPSE
 * - Emits: EventTypes.PANEL_GROUP_REMOVED (when closed or empty)
 * - Emits: EventTypes.LAYOUT_PANELGROUPS_CHANGED (to notify LayoutService)
 *
 * Dependencies:
 * - {import('./PanelGroupHeader.js').PanelGroupHeader}
 * - {import('./PanelFactory.js').PanelFactory}
 * - {import('./Panel.js').Panel}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../utils/ThrottleRAF.js').throttleRAF}
 * - {import('../../utils/generateId.js').generateId}
 * - {import('../../services/DND/FloatingPanelManagerService.js').FloatingPanelManagerService}
 * - {import('../../utils/ResizeHandleManager.js').ResizeHandleManager}
 * - {import('../../constants/DNDTypes.js').ItemType}
 * - {import('../../constants/DNDTypes.js').DropZoneType}
 * - {import('../../constants/EventTypes.js').EventTypes}
 */
export class PanelGroup {
    /**
     * Unique ID for this PanelGroup instance.
     * Also used as the appBus namespace.
     *
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * Unique namespace for appBus listeners.
     *
     * @type {string}
     * @private
     */
    _namespace = this.id;

    /**
     * The throttled (rAF) update function for resizing (used in docked mode only).
     *
     * @type {Function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * Internal state for orientation, position, and groups.
     *
     * @type {{
     * column: import('../Column/Column.js').Column | null,
     * header: PanelGroupHeader | null,
     * contentContainer: HTMLElement | null,
     * panels: Array<Panel>,
     * activePanel: Panel | null,
     * collapsed: boolean,
     * height: number | null,
     * width: number | null,
     * minHeight: number,
     * minWidth: number,
     * closable: boolean,
     * collapsible: boolean,
     * movable: boolean,
     * title: string | null,
     * isFloating: boolean,
     * x: number | null,
     * y: number | null
     * }}
     * @private
     */
    _state = {
        column: null,
        header: null,
        contentContainer: null,
        panels: [],
        activePanel: null,
        collapsed: false,
        height: null,
        width: null,
        minHeight: 10,
        minWidth: 150,
        closable: true,
        collapsible: true,
        movable: true,
        title: null,
        isFloating: false,
        x: null,
        y: null
    };

    /**
     * Bound handler for panel child close requests.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnChildCloseRequest = null;

    /**
     * Bound handler for app close panel request from context menu.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnChildCloseRequestFromContext = null;

    /**
     * Bound handler for panel group close request.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnCloseRequest = null;

    /**
     * Bound handler for panel group toggle collapse request.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnToggleCollapseRequest = null;

    /**
     * The unified manager for all resize handles (docked vertical or floating 8-way).
     *
     * @type {ResizeHandleManager | null}
     * @private
     */
    _resizeHandleManager = null;

    /**
     * @param {Panel | null} [initialPanel=null] - The optional first panel.
     * @param {number|null} [height=null] - The initial height of the group.
     * @param {boolean} [collapsed=false] - The initial collapsed state.
     * @param {object} [config={}] - Configuration overrides for the group.
     */
    constructor(initialPanel = null, height = null, collapsed = false, config = {}) {
        const me = this;
        Object.assign(me._state, config);

        me.dropZoneType = DropZoneType.TAB_CONTAINER;

        me._state.contentContainer = document.createElement('div');
        me._state.contentContainer.classList.add('panel-group__content');

        me._state.collapsed = collapsed;
        me.element = document.createElement('div');
        me.element.classList.add('panel-group');
        me.element.classList.add('panel');

        // Bring to front on click when floating
        me.element.addEventListener('pointerdown', () => {
            if (me._state.isFloating) {
                FloatingPanelManagerService.getInstance().bringToFront(me);
            }
        });

        me._state.header = new PanelGroupHeader(me);

        if (height !== null) {
            me._state.height = height;
        }

        me._boundOnChildCloseRequest = me.onChildCloseRequest.bind(me);
        me._boundOnChildCloseRequestFromContext = me.onChildCloseRequestFromContext.bind(me);
        me._boundOnCloseRequest = me.onCloseRequest.bind(me);
        me._boundOnToggleCollapseRequest = me.onToggleCollapseRequest.bind(me);

        me.build();
        me.setFloatingState(me._state.isFloating, me._state.x, me._state.y);

        if (initialPanel) {
            me.addPanel(initialPanel, null, true);
        }

        me.initEventListeners();

        me.setThrottledUpdate(
            throttleRAF(() => {
                me.updateHeight();
            })
        );
    }

    /**
     * ThrottledUpdate setter.
     *
     * @param {Function} throttledFunction - The throttled function to set.
     * @returns {void}
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * ThrottledUpdate getter.
     *
     * @returns {Function | null} The throttled update function.
     */
    getThrottledUpdate() {
        return this._throttledUpdate;
    }

    /**
     * HeaderHeight getter.
     *
     * @returns {number} The height of the header element.
     */
    getHeaderHeight() {
        return this._state.header ? this._state.header.element.offsetHeight : 0;
    }

    /**
     * MinPanelHeight getter.
     * Calculates the minimum panel height based on header height and active panel content's minHeight.
     *
     * @returns {number} The calculated minimum panel height.
     */
    getMinPanelHeight() {
        const me = this;
        const headerHeight = me.getHeaderHeight();
        const activeMinHeight = me._state.activePanel
            ? me._state.activePanel.getMinPanelHeight()
            : 0;

        // For docked mode, we might want to include the resize handle height in calculation if needed
        return Math.max(me._state.minHeight, activeMinHeight) + headerHeight;
    }

    /**
     * MinPanelWidth getter.
     *
     * @returns {number} The calculated minimum panel width.
     */
    getMinPanelWidth() {
        const me = this;
        const activePanelMinWidth = me._state.activePanel
            ? me._state.activePanel.getMinPanelWidth()
            : 0;

        return Math.max(me._state.minWidth, activePanelMinWidth);
    }

    /**
     * ParentColumn setter.
     *
     * @param {import('../Column/Column.js').Column} column - The parent column instance.
     * @returns {void}
     */
    setParentColumn(column) {
        this._state.column = column;
    }

    /**
     * Column getter.
     *
     * @returns {import('../Column/Column.js').Column | null} The parent column instance.
     */
    getColumn() {
        return this._state.column;
    }

    /**
     * Sets the floating state and updates the DOM, managing the correct resize handles.
     *
     * @param {boolean} isFloating - Whether the panel should be floating.
     * @param {number|null} x - The initial X coordinate (relative to container).
     * @param {number|null} y - The initial Y coordinate (relative to container).
     * @returns {void}
     */
    setFloatingState(isFloating, x, y) {
        const me = this;

        // 1. Clean up old manager regardless of new state
        me._resizeHandleManager?.destroy();
        me._resizeHandleManager = null;

        me._state.isFloating = isFloating;
        me._state.x = x;
        me._state.y = y;

        if (me._state.header && me._state.header.collapseBtn) {
            me._state.header.collapseBtn.disabled = !me._state.collapsible;
        }

        if (isFloating) {
            // --- FLOATING STATE SETUP (8-way Resize) ---

            me.element.classList.add('panel-group--floating');
            me.element.classList.remove('panel-group--fills-space');

            me.element.style.left = `${x}px`;
            me.element.style.top = `${y}px`;
            if (me._state.width !== null) {
                me.element.style.width = `${me._state.width}px`;
            }
            if (me._state.height !== null) {
                me.element.style.height = `${me._state.height}px`;
            }

            const fpms = FloatingPanelManagerService.getInstance();

            me._resizeHandleManager = new ResizeHandleManager(me.element, {
                handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                customClass: 'panel-group__resize-handle--floating',
                getConstraints: () => ({
                    minimumWidth: me.getMinPanelWidth(),
                    maximumWidth: Infinity,
                    minimumHeight: me.getMinPanelHeight(),
                    maximumHeight: Infinity,
                    // Critical for preventing panels from being dragged or resized outside of the main container
                    containerRectangle: fpms.getContainerBounds()
                }),
                onResize: ({ xCoordinate, yCoordinate, width, height }) => {
                    // Apply dimensions and position directly to the DOM and state
                    me.element.style.left = `${xCoordinate}px`;
                    me.element.style.top = `${yCoordinate}px`;
                    me.element.style.width = `${width}px`;
                    me.element.style.height = `${height}px`;

                    me._state.x = xCoordinate;
                    me._state.y = yCoordinate;
                    me._state.width = width;
                    me._state.height = height;

                    me.updateHeight();
                }
            });
        } else {
            // --- DOCKED STATE SETUP (Vertical 's' only) ---

            me.element.classList.remove('panel-group--floating');
            me.element.style.left = '';
            me.element.style.top = '';
            me.element.style.width = '';
            me.element.style.height = '';

            // Only allow resize if the group is collapsible.
            // Removed the '&& me._state.column' check to ensure handles appear even if column is not set yet.
            if (me._state.collapsible) {
                me._resizeHandleManager = new ResizeHandleManager(me.element, {
                    handles: ['s'],
                    customClass: 'panel-group__resize-handle',
                    getConstraints: () => ({
                        minimumWidth: 0,
                        maximumWidth: Infinity,
                        minimumHeight: me.getMinPanelHeight(),
                        maximumHeight: Infinity,
                        containerRectangle: null
                    }),
                    onResize: ({ height }) => {
                        me._state.height = height;
                        me.getThrottledUpdate()();
                    },
                    onEnd: () => me.requestLayoutUpdate()
                });
            }
        }
        // Ensure buttons update correctly
        me._updateHeaderMode();
    }

    /**
     * Initializes appBus event listeners for this component.
     *
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };

        appBus.on(EventTypes.PANEL_GROUP_CHILD_CLOSE, me._boundOnChildCloseRequest, options);
        appBus.on(
            EventTypes.APP_CLOSE_PANEL_REQUEST,
            me._boundOnChildCloseRequestFromContext,
            options
        );
        appBus.on(EventTypes.PANEL_CLOSE_REQUEST, me._boundOnCloseRequest, options);
        appBus.on(EventTypes.PANEL_TOGGLE_COLLAPSE, me._boundOnToggleCollapseRequest, options);
    }

    /**
     * Event handler for when a child Panel (tab) requests to close.
     *
     * @param {object} eventData - The event payload containing panel and group references.
     * @returns {void}
     */
    onChildCloseRequest({ panel, group }) {
        if (group === this && this._state.panels.includes(panel)) {
            this.removePanel(panel, false);
        }
    }

    /**
     * Event handler for 'app:close-panel-request' from ContextMenu.
     *
     * @param {object} contextData - The data from the context menu action.
     * @returns {void}
     */
    onChildCloseRequestFromContext(contextData) {
        this.onChildCloseRequest(contextData);
    }

    /**
     * Event handler for when this entire PanelGroup requests to close.
     *
     * @param {Panel | PanelGroup} panel - The component instance requesting closure.
     * @returns {void}
     */
    onCloseRequest(panel) {
        if (panel === this) {
            this.close();
        }
    }

    /**
     * Event handler to toggle the collapse state of this PanelGroup.
     *
     * @param {Panel | PanelGroup} panel - The component instance requesting collapse toggle.
     * @returns {void}
     */
    onToggleCollapseRequest(panel) {
        if (panel === this) {
            this.toggleCollapse();
        }
    }

    /**
     * Cleans up appBus listeners and destroys child components.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        me._state.header?.destroy();
        me._state.panels.forEach(panel => panel.destroy());
        me.getThrottledUpdate()?.cancel();

        me._resizeHandleManager?.destroy();

        // Clean up element
        me.element.remove();
    }

    /**
     * Builds the component's main DOM structure.
     *
     * @returns {void}
     */
    build() {
        const me = this;

        // The manager will create and append the resize handle DOM elements when instantiated.
        me.element.append(me._state.header.element, me._state.contentContainer);

        if (!me._state.movable) {
            me.element.classList.add('panel--not-movable');
        }

        me.updateCollapse();
    }

    /**
     * Gets the panel type identifier.
     *
     * @returns {string} The item type constant string.
     */
    getPanelType() {
        return ItemType.PANEL_GROUP;
    }

    /**
     * Toggles the collapse state and requests a layout update.
     *
     * @returns {void}
     */
    toggleCollapse() {
        const me = this;
        if (me._state.collapsed) {
            me.unCollapse();
        } else {
            me.collapse();
        }

        me.requestLayoutUpdate();
    }

    /**
     * Applies the correct visibility state based on the internal state.
     *
     * @returns {void}
     */
    updateCollapse() {
        const me = this;
        if (me._state.collapsed) {
            me.collapse();
        } else {
            me.unCollapse();
        }
    }

    /**
     * Hides the content and applies collapsed styles.
     * Also ensures resize handles are hidden to prevent resizing while collapsed.
     *
     * @returns {void}
     */
    collapse() {
        const me = this;
        me._state.collapsed = true;
        me.element.classList.add('panel--collapsed');
        me._state.contentContainer.style.display = 'none';

        // Rule: Hide resize handles when collapsed
        const handles = me.element.querySelectorAll('.resize-handle');
        handles.forEach(h => (h.style.display = 'none'));

        me.updateHeight();
    }

    /**
     * Shows the content and removes collapsed styles.
     * Also restores resize handles.
     *
     * @returns {void}
     */
    unCollapse() {
        const me = this;
        me._state.collapsed = false;
        me.element.classList.remove('panel--collapsed');
        me._state.contentContainer.style.display = '';

        // Rule: Show resize handles when uncollapsed
        const handles = me.element.querySelectorAll('.resize-handle');
        handles.forEach(h => (h.style.display = ''));

        me.updateHeight();
    }

    /**
     * Closes the entire PanelGroup and notifies its parent Column.
     *
     * @returns {void}
     */
    close() {
        const me = this;
        if (!me._state.closable) return;

        appBus.emit(EventTypes.PANEL_GROUP_REMOVED, { panel: me, column: me._state.column });
        me.destroy();
    }

    /**
     * Updates the CSS height/flex properties based on the current state.
     *
     * @returns {void}
     */
    updateHeight() {
        const me = this;
        if (me._state.collapsed) {
            me.element.style.height = 'auto';
            me.element.style.flex = '0 0 auto';
            me.element.classList.add('panel--collapsed');
            me.element.style.minHeight = 'auto';

            if (me._state.header) {
                me._state.header.updateScrollButtons();
            }
            return;
        }

        me.element.classList.remove('panel--collapsed');

        const minPanelHeight = me.getMinPanelHeight();
        me.element.style.minHeight = `${minPanelHeight}px`;

        if (me._state.height !== null && !me._state.isFloating) {
            me.element.style.height = `${me._state.height}px`;
            me.element.style.flex = '0 0 auto';
        } else if (!me._state.isFloating) {
            me.element.style.height = 'auto';
            me.element.style.flex = '0 0 auto';
        }

        if (me._state.header) {
            me._state.header.updateScrollButtons();
        }
    }

    /**
     * Updates the header's visual mode (simple vs. tabs).
     *
     * @private
     * @returns {void}
     */
    _updateHeaderMode() {
        const me = this;
        if (!me._state.header) return;

        const isSimpleMode = me._state.panels.length === 1;

        me._state.header.element.classList.toggle('panel-group__header--simple', isSimpleMode);

        if (isSimpleMode && me._state.panels.length === 1) {
            const panel = me._state.panels[0];
            me._state.header.collapseBtn.style.display =
                panel._state.collapsible && me._state.collapsible ? '' : 'none';
            me._state.header.closeBtn.style.display =
                panel._state.closable && me._state.closable ? '' : 'none';
            me._state.header.moveHandle.style.display =
                panel._state.movable && me._state.movable ? '' : 'none';
        } else {
            me._state.header.collapseBtn.style.display = me._state.collapsible ? '' : 'none';
            me._state.header.closeBtn.style.display = me._state.closable ? '' : 'none';
            me._state.header.moveHandle.style.display = me._state.movable ? '' : 'none';
        }
    }

    /**
     * Adds a child Panel (tab) to this group at a specific index.
     *
     * @param {Panel} panel - The panel instance to add.
     * @param {number|null} [index=null] - The index to insert at. Appends if null.
     * @param {boolean} [makeActive=false] - Whether to make this panel active.
     * @returns {void}
     */
    addPanel(panel, index = null, makeActive = false) {
        const me = this;
        if (!panel || !(panel instanceof Panel)) {
            console.warn('PanelGroup.addPanel: item is not an instance of Panel.', panel);
            return;
        }
        if (me._state.panels.includes(panel)) {
            if (makeActive) me.setActive(panel);
            return;
        }

        const currentPanelCount = me._state.panels.length;

        if (currentPanelCount === 0) {
            panel._state.header.setMode(true);
        } else if (currentPanelCount === 1) {
            me._state.panels[0]._state.header.setMode(false);
            panel._state.header.setMode(false);
        } else {
            panel._state.header.setMode(false);
        }

        panel.setParentGroup(me);
        me._state.contentContainer.appendChild(panel.contentElement);

        const tabContainer = me._state.header.tabContainer;
        const tabElement = panel._state.header.element;
        const safeIndex = index === null ? me._state.panels.length : index;

        if (safeIndex >= me._state.panels.length) {
            me._state.panels.push(panel);
            tabContainer.appendChild(tabElement);
        } else {
            me._state.panels.splice(safeIndex, 0, panel);
            const nextSiblingPanel = me._state.panels[safeIndex + 1];
            const nextSiblingTabElement = nextSiblingPanel
                ? nextSiblingPanel._state.header.element
                : null;
            tabContainer.insertBefore(tabElement, nextSiblingTabElement);
        }

        me._updateHeaderMode();
        me._state.header.updateScrollButtons();

        if (makeActive || me._state.panels.length === 1) {
            me.setActive(panel);
        } else {
            panel.contentElement.style.display = 'none';
            me.requestLayoutUpdate();
        }
    }

    /**
     * Adds multiple child Panels (tabs) at once, optimized for state loading.
     *
     * @param {Array<Panel>} panels - The panel instances to add.
     * @returns {void}
     */
    addPanelsBulk(panels) {
        const me = this;
        if (!panels || panels.length === 0) return;

        panels.forEach(panel => {
            panel._state.header.setMode(false);
            panel.setParentGroup(me);

            me._state.header.tabContainer.appendChild(panel._state.header.element);
            me._state.contentContainer.appendChild(panel.contentElement);

            panel.contentElement.style.display = 'none';
        });

        me._state.panels.push(...panels);
    }

    /**
     * Removes a child Panel (tab) from this group.
     *
     * @param {Panel} panel - The panel instance to remove.
     * @param {boolean} [isMoving=false] - If true, panel is not destroyed (DND operation).
     * @returns {void}
     */
    removePanel(panel, isMoving = false) {
        const me = this;
        const index = me._state.panels.indexOf(panel);
        if (index === -1) return;

        if (!isMoving) {
            panel.destroy();
        }

        panel._state.header.element.classList.remove('panel-group__tab--active');
        panel._state.header.element.remove();
        panel.contentElement.remove();

        me._state.panels.splice(index, 1);
        panel.setParentGroup(null);

        const newPanelCount = me._state.panels.length;
        if (newPanelCount === 1) {
            const remainingPanel = me._state.panels[0];
            remainingPanel._state.header.setMode(true);
            me.setActive(remainingPanel);
        }

        me._updateHeaderMode();
        me._state.header.updateScrollButtons();

        if (me._state.panels.length === 0) {
            me.close();
            return;
        }

        if (panel === me._state.activePanel) {
            const newActive = me._state.panels[index] || me._state.panels[index - 1];
            me.setActive(newActive);
        } else {
            if (newPanelCount > 1) {
                me.requestLayoutUpdate();
            }
        }
    }

    /**
     * Moves an existing Panel (tab) to a new index within this group.
     *
     * @param {Panel} panel - The Panel instance to move.
     * @param {number} newIndex - The target index.
     * @returns {void}
     */
    movePanel(panel, newIndex) {
        const me = this;
        if (!panel || newIndex < 0) {
            return;
        }

        const oldIndex = me._state.panels.indexOf(panel);
        if (oldIndex === -1) {
            console.warn('PanelGroup.movePanel: Panel not found in this group.');
            return;
        }

        if (oldIndex === newIndex) {
            return;
        }

        me._state.panels.splice(oldIndex, 1);

        const adjustedNewIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
        me._state.panels.splice(adjustedNewIndex, 0, panel);

        const tabContainer = me._state.header.tabContainer;
        const tabElement = panel._state.header.element;

        const nextSiblingPanel = me._state.panels[adjustedNewIndex + 1];
        const nextSiblingTabElement = nextSiblingPanel
            ? nextSiblingPanel._state.header.element
            : null;

        tabContainer.insertBefore(tabElement, nextSiblingTabElement);

        me._state.header.updateScrollButtons();
    }

    /**
     * Sets a child Panel (tab) as the active one.
     *
     * @param {Panel} panel - The panel instance to activate.
     * @returns {void}
     */
    setActive(panel) {
        const me = this;
        const isSimpleMode = me._state.panels.length === 1;

        if (!panel) {
            return;
        }
        if (panel === me._state.activePanel && !isSimpleMode) {
            return;
        }

        const oldActivePanel = me._state.activePanel;
        oldActivePanel?.unmount();

        me._state.panels.forEach(p => {
            p._state.header.element.classList.remove('panel-group__tab--active');
            p.contentElement.style.display = 'none';
        });

        if (!isSimpleMode) {
            panel._state.header.element.classList.add('panel-group__tab--active');
        }

        panel.contentElement.style.display = '';

        me._state.activePanel = panel;
        me._state.title = panel._state.title;
        me._state.header.updateAriaLabels();

        panel.mount();

        me.updateHeight();
    }

    /**
     * Emits an event to the LayoutService if this group is attached to a column.
     *
     * @returns {void}
     */
    requestLayoutUpdate() {
        const column = this.getColumn();
        if (column && !this._state.isFloating) {
            appBus.emit(EventTypes.LAYOUT_PANELGROUPS_CHANGED, column);
        }
    }

    /**
     * Serializes the PanelGroup state (and its child Panels) to JSON.
     *
     * @returns {object} The serialized state object.
     */
    toJSON() {
        const me = this;
        return {
            id: me.id,
            type: me.getPanelType(),
            height: me._state.height,
            width: me._state.width,
            collapsed: me._state.collapsed,
            activePanelId: me._state.activePanel ? me._state.activePanel.id : null,
            isFloating: me._state.isFloating,
            x: me._state.x,
            y: me._state.y,
            config: {
                closable: me._state.closable,
                collapsible: me._state.collapsible,
                movable: me._state.movable,
                minHeight: me._state.minHeight,
                minWidth: me._state.minWidth
            },
            panels: me._state.panels.map(panel => panel.toJSON())
        };
    }

    /**
     * Deserializes state from JSON data.
     *
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        if (data.id) {
            me.id = data.id;
            me._namespace = me.id;
        }
        if (data.height !== undefined) {
            me._state.height = data.height;
        }
        if (data.width !== undefined) {
            me._state.width = data.width;
        }
        if (data.collapsed !== undefined) {
            me._state.collapsed = data.collapsed;
        }
        if (data.isFloating !== undefined) {
            me._state.isFloating = data.isFloating;
        }
        if (data.x !== undefined) {
            me._state.x = data.x;
        }
        if (data.y !== undefined) {
            me._state.y = data.y;
        }
        if (data.config) {
            Object.assign(me._state, data.config);
        }

        const activePanelId = data.activePanelId;
        let activePanelInstance = null;
        const panelInstances = [];

        if (data.panels && Array.isArray(data.panels)) {
            const factory = PanelFactory.getInstance();

            data.panels.forEach(panelData => {
                const panel = factory.createPanel(panelData);
                if (panel) {
                    panelInstances.push(panel);
                    if (panel.id === activePanelId) {
                        activePanelInstance = panel;
                    }
                }
            });
        }

        if (panelInstances.length === 1) {
            me.addPanel(panelInstances[0], null, true);
        } else if (panelInstances.length > 1) {
            me.addPanelsBulk(panelInstances);

            if (!activePanelInstance) {
                activePanelInstance = panelInstances[0];
            }
            if (activePanelInstance) {
                me.setActive(activePanelInstance);
            }
        }

        me.updateHeight();
        me.updateCollapse();
    }
}
