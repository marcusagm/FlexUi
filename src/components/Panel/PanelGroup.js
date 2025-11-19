import { PanelGroupHeader } from './PanelGroupHeader.js';
import { PanelFactory } from './PanelFactory.js';
import { Panel } from './Panel.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';
import { FloatingPanelManagerService } from '../../services/DND/FloatingPanelManagerService.js';
import { ResizeController } from '../../utils/ResizeController.js';
import { ItemType, DropZoneType } from '../../constants/DNDTypes.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Manages a group of Panel (tabs) within a Column. This class acts as an
 * "Orchestrator" for its child Panel components. It does not render tabs
 * itself; instead, it retrieves the header element (the "tab") and the content
 * element from each child Panel and appends them to its own internal
 * containers (TabContainer and ContentContainer).
 *
 * Properties summary:
 * - id {string} : Unique ID for this instance (also used as namespace).
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - _throttledUpdate {Function | null} : The throttled function for height updates.
 * - _state {object} : Internal state (child Panels, layout, parent Column).
 * - element {HTMLElement} : The main DOM element (<div class="panel-group">).
 * - _resizeHandleDocked {HTMLElement} : The bottom resize handle for docked state.
 * - _floatingHandles {object} : Floating resize handles (se, s, e).
 * - _resizeControllers {Map<string, ResizeController>} : Controllers for resize logic.
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
 * Business rules implemented:
 * - Orchestrates Panel DOM (header vs. content).
 * - Manages active tab state ('setActive').
 * - Renders in "simple mode" (no tabs) if only one child Panel exists.
 * - Manages its own vertical resize (docked) and 2D resize (floating) via ResizeController.
 * - If last Panel is removed, destroys itself ('removePanel' -> 'close').
 * - Calculates minHeight dynamically based on panel content and resize handle visibility.
 *
 * Dependencies:
 * - ./PanelGroupHeader.js
 * - ./PanelFactory.js
 * - ./Panel.js
 * - ../../utils/EventBus.js
 * - ../../utils/ThrottleRAF.js
 * - ../../utils/generateId.js
 * - ../../services/DND/FloatingPanelManagerService.js
 * - ../../utils/ResizeController.js
 * - ../../constants/DNDTypes.js
 * - ../../constants/EventTypes.js
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
     * The throttled (rAF) update function for resizing.
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
     * The docked resize handle (bottom).
     *
     * @type {HTMLElement}
     * @private
     */
    _resizeHandleDocked = null;

    /**
     * Floating resize handles.
     *
     * @type {{
     * se: HTMLElement,
     * s: HTMLElement,
     * e: HTMLElement
     * }}
     * @private
     */
    _floatingHandles = {
        se: null,
        s: null,
        e: null
    };

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

        me._createFloatingResizeHandles();

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

        me._initResizeControllers();
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
     * Calculates the minimum panel height, including the dynamic height
     * of the docked resize handle (if visible).
     *
     * @returns {number} The calculated minimum panel height.
     */
    getMinPanelHeight() {
        const me = this;
        const headerHeight = me.getHeaderHeight();
        const activeMinHeight = me._state.activePanel
            ? me._state.activePanel.getMinPanelHeight()
            : 0;

        const handleHeight =
            me._resizeHandleDocked && me._resizeHandleDocked.offsetParent
                ? me._resizeHandleDocked.offsetHeight
                : 0;

        return Math.max(me._state.minHeight, activeMinHeight) + headerHeight + handleHeight;
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
     * Sets the floating state and updates the DOM.
     *
     * @param {boolean} isFloating - Whether the panel should be floating.
     * @param {number|null} x - The X coordinate (relative to container).
     * @param {number|null} y - The Y coordinate (relative to container).
     * @returns {void}
     */
    setFloatingState(isFloating, x, y) {
        const me = this;
        me._state.isFloating = isFloating;
        me._state.x = x;
        me._state.y = y;

        if (isFloating) {
            me.element.classList.add('panel-group--floating');

            // Reset constraints applied by LayoutService
            me.element.classList.remove('panel-group--fills-space');
            if (me._state.header && me._state.header.collapseBtn) {
                me._state.header.collapseBtn.disabled = !me._state.collapsible;
            }

            me.element.style.left = `${x}px`;
            me.element.style.top = `${y}px`;
            if (me._state.width !== null) {
                me.element.style.width = `${me._state.width}px`;
            }
            if (me._state.height !== null) {
                me.element.style.height = `${me._state.height}px`;
            }
        } else {
            me.element.classList.remove('panel-group--floating');
            me.element.style.left = '';
            me.element.style.top = '';
            me.element.style.width = '';
            me.element.style.height = '';
        }
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
        me._resizeHandleDocked = document.createElement('div');
        me._resizeHandleDocked.classList.add('panel-group__resize-handle');
        me._resizeHandleDocked.style.touchAction = 'none';

        me.element.append(
            me._state.header.element,
            me._state.contentContainer,
            me._resizeHandleDocked,
            me._floatingHandles.se,
            me._floatingHandles.s,
            me._floatingHandles.e
        );

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
     *
     * @returns {void}
     */
    collapse() {
        const me = this;
        me._state.collapsed = true;
        me.element.classList.add('panel--collapsed');
        me._state.contentContainer.style.display = 'none';
        me._resizeHandleDocked.style.display = 'none';
        me.updateHeight();
    }

    /**
     * Shows the content and removes collapsed styles.
     *
     * @returns {void}
     */
    unCollapse() {
        const me = this;
        me._state.collapsed = false;
        me.element.classList.remove('panel--collapsed');
        me._state.contentContainer.style.display = '';
        me._resizeHandleDocked.style.display = '';
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
     * Creates the DOM elements for floating resize handles.
     *
     * @private
     * @returns {void}
     */
    _createFloatingResizeHandles() {
        const me = this;
        me._floatingHandles.se = document.createElement('div');
        me._floatingHandles.s = document.createElement('div');
        me._floatingHandles.e = document.createElement('div');

        me._floatingHandles.se.className =
            'panel-group__resize-handle--floating panel-group__resize-handle--se';
        me._floatingHandles.s.className =
            'panel-group__resize-handle--floating panel-group__resize-handle--s';
        me._floatingHandles.e.className =
            'panel-group__resize-handle--floating panel-group__resize-handle--e';

        // Touch action none is critical for Pointer Events
        me._floatingHandles.se.style.touchAction = 'none';
        me._floatingHandles.s.style.touchAction = 'none';
        me._floatingHandles.e.style.touchAction = 'none';
    }

    /**
     * Initializes ResizeControllers for all handles (docked and floating).
     * Uses a composite strategy for the SE handle to allow 2D resizing using
     * the 1D ResizeController.
     *
     * @private
     * @returns {void}
     */
    _initResizeControllers() {
        const me = this;
        let startH = 0;
        let startW = 0;

        // --- 1. Docked Resize (Vertical Only) ---
        const dockedController = new ResizeController(me._resizeHandleDocked, 'vertical', {
            onStart: () => {
                startH = me.element.offsetHeight;
            },
            onUpdate: delta => {
                me._state.height = Math.max(me.getMinPanelHeight(), startH + delta);
                me.getThrottledUpdate()();
            },
            onEnd: () => me.requestLayoutUpdate()
        });

        me._resizeHandleDocked.addEventListener('pointerdown', event => {
            if (!me._state.isFloating && !me._state.collapsed) {
                dockedController.start(event);
            }
        });

        // --- 2. Floating Resize Logic Helpers ---
        const getBounds = () => FloatingPanelManagerService.getInstance().getContainerBounds();

        const updateFloatingSize = (deltaW, deltaH) => {
            const bounds = getBounds();
            if (!bounds) return;

            const minWidth = me.getMinPanelWidth();
            const minHeight = me.getMinPanelHeight();

            // Clamping Logic
            const maxWidth = bounds.width - (me._state.x || 0);
            const maxHeight = bounds.height - (me._state.y || 0);

            if (deltaW !== null) {
                const newW = Math.max(minWidth, Math.min(startW + deltaW, maxWidth));
                me.element.style.width = `${newW}px`;
                me._state.width = newW;
            }
            if (deltaH !== null) {
                const newH = Math.max(minHeight, Math.min(startH + deltaH, maxHeight));
                me.element.style.height = `${newH}px`;
                me._state.height = newH;
            }
        };

        // --- 3. Floating Handle: South (Vertical) ---
        const floatS = new ResizeController(me._floatingHandles.s, 'vertical', {
            onStart: () => {
                startH = me.element.offsetHeight;
            },
            onUpdate: delta => updateFloatingSize(null, delta)
        });
        me._floatingHandles.s.addEventListener('pointerdown', event => {
            if (me._state.isFloating) floatS.start(event);
        });

        // --- 4. Floating Handle: East (Horizontal) ---
        const floatE = new ResizeController(me._floatingHandles.e, 'horizontal', {
            onStart: () => {
                startW = me.element.offsetWidth;
            },
            onUpdate: delta => updateFloatingSize(delta, null)
        });
        me._floatingHandles.e.addEventListener('pointerdown', event => {
            if (me._state.isFloating) floatE.start(event);
        });

        // --- 5. Floating Handle: South-East (2D) ---
        // Uses two controllers simultaneously for 2D effect
        const floatSE_V = new ResizeController(me._floatingHandles.se, 'vertical', {
            onStart: () => {
                startH = me.element.offsetHeight;
            },
            onUpdate: delta => updateFloatingSize(null, delta)
        });

        const floatSE_H = new ResizeController(me._floatingHandles.se, 'horizontal', {
            onStart: () => {
                startW = me.element.offsetWidth;
            },
            onUpdate: delta => updateFloatingSize(delta, null)
        });

        me._floatingHandles.se.addEventListener('pointerdown', event => {
            if (me._state.isFloating) {
                floatSE_V.start(event);
                floatSE_H.start(event);
            }
        });
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
