import { PanelGroupHeader } from './PanelGroupHeader.js';
import { PanelFactory } from './PanelFactory.js';
import { Panel } from './Panel.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { generateId } from '../../utils/generateId.js';
import { FloatingPanelManagerService } from '../../services/DND/FloatingPanelManagerService.js';

/**
 * Description:
 * Manages a group of Panel (tabs) within a Column. This class acts as an
 * "Orchestrator" for its child Panel components. It does not render tabs
 * itself; instead, it retrieves the header element (the tab) and the content
 * element from each child Panel and appends them to its own internal
 * containers (TabContainer and ContentContainer).
 *
 * Properties summary:
 * - _state {object} : Internal state (child Panels, layout, parent Column).
 * - element {HTMLElement} : The main DOM element (<div class="panel-group">).
 * - id {string} : Unique ID for this instance.
 * - _namespace {string} : Unique namespace for appBus listeners (uses this.id).
 *
 * Typical usage:
 * // In Column.js
 * const panel = new TextPanel(...);
 * const panelGroup = new PanelGroup(panel);
 * column.addPanelGroup(panelGroup);
 *
 * Events:
 * - Listens to: 'panel:group-child-close-request' (from PanelHeader via Panel)
 * - Listens to: 'panel:close-request' (from PanelGroupHeader)
 * - Listens to: 'panel:toggle-collapse-request' (from PanelGroupHeader)
 * - Listens to: 'app:close-panel-request' (from ContextMenu)
 * - Emits: 'panelgroup:removed' (when closed or empty)
 * - Emits: 'layout:panel-groups-changed' (to notify LayoutService)
 *
 * Business rules implemented:
 * - Orchestrates Panel DOM (header vs. content).
 * - Manages active tab state ('setActive').
 * - Renders in "simple mode" (no tabs) if only one child Panel exists.
 * - Manages its own vertical resize ('startResize').
 * - Enforces 'canCollapse' rule (must not be the last visible group).
 * - If last Panel is removed, destroys itself ('removePanel' -> 'close').
 *
 * Dependencies:
 * - ./PanelGroupHeader.js
 * - ./PanelFactory.js
 * - ./Panel.js
 * - ../../utils/EventBus.js
 * - ../../utils/ThrottleRAF.js
 * - ../../utils/generateId.js
 */
export class PanelGroup {
    /**
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
        minHeight: 100,
        minWidth: 150,
        closable: true,
        collapsible: true,
        movable: true,
        hasTitle: true,
        title: null,
        isFloating: false,
        x: null,
        y: null
    };

    /**
     * Unique ID for this PanelGroup instance.
     * Also used as the appBus namespace.
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * Unique namespace for appBus listeners.
     * @type {string}
     * @private
     */
    _namespace = this.id;

    /**
     * The throttled (rAF) update function for resizing.
     * @type {Function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnChildCloseRequest = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnChildCloseRequestFromContext = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnCloseRequest = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnToggleCollapseRequest = null;

    /**
     * @type {HTMLElement}
     * @private
     */
    _resizeHandleSE = null;

    /**
     * @type {HTMLElement}
     * @private
     */
    _resizeHandleS = null;

    /**
     * @type {HTMLElement}
     * @private
     */
    _resizeHandleE = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnFloatingResizeStart = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnFloatingResizeMove = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnFloatingResizeUp = null;

    /**
     * Tracks coordinates during floating resize.
     * @type {object}
     * @private
     */
    _resizeState = {
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        direction: null
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

        me.dropZoneType = 'TabContainer';

        me._state.contentContainer = document.createElement('div');
        me._state.contentContainer.classList.add('panel-group__content');

        me._state.collapsed = collapsed;
        me.element = document.createElement('div');
        me.element.classList.add('panel-group');
        me.element.classList.add('panel');

        me.element.addEventListener('mousedown', () => {
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
        me._boundOnFloatingResizeStart = me._onFloatingResizeStart.bind(me);
        me._boundOnFloatingResizeMove = me._onFloatingResizeMove.bind(me);
        me._boundOnFloatingResizeUp = me._onFloatingResizeUp.bind(me);
        me._initFloatingResizeListeners();

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
     * <ThrottledUpdate> setter.
     * @param {Function} throttledFunction
     * @returns {void}
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * <ThrottledUpdate> getter.
     * @returns {Function | null}
     */
    getThrottledUpdate() {
        return this._throttledUpdate;
    }

    /**
     * <HeaderHeight> getter.
     * @returns {number} The height of the header element.
     */
    getHeaderHeight() {
        return this._state.header ? this._state.header.element.offsetHeight : 0;
    }

    /**
     * <MinPanelHeight> getter.
     * @returns {number} The calculated minimum panel height.
     */
    getMinPanelHeight() {
        const me = this;
        const headerHeight = me.getHeaderHeight();
        const activeMinHeight = me._state.activePanel
            ? me._state.activePanel.getMinPanelHeight()
            : 0;

        return Math.max(me._state.minHeight, activeMinHeight) + headerHeight;
    }

    /**
     * <MinPanelWidth> getter.
     * @returns {number} The calculated minimum panel width.
     */
    getMinPanelWidth() {
        return this._state.minWidth;
    }

    /**
     * <ParentColumn> setter.
     * @param {import('../Column/Column.js').Column} column - The parent column instance.
     * @returns {void}
     */
    setParentColumn(column) {
        this._state.column = column;
    }

    /**
     * <Column> getter.
     * @returns {import('../Column/Column.js').Column | null}
     */
    getColumn() {
        return this._state.column;
    }

    /**
     * Sets the floating state and updates the DOM.
     * @param {boolean} isFloating - Whether the panel should be floating.
     * @param {number|null} x - The X coordinate.
     * @param {number|null} y - The Y coordinate.
     * @returns {void}
     */
    setFloatingState(isFloating, x, y) {
        const me = this;
        me._state.isFloating = isFloating;
        me._state.x = x;
        me._state.y = y;

        if (isFloating) {
            me.element.classList.add('panel-group--floating');
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
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };

        appBus.on('panel:group-child-close-request', me._boundOnChildCloseRequest, options);
        appBus.on('app:close-panel-request', me._boundOnChildCloseRequestFromContext, options);
        appBus.on('panel:close-request', me._boundOnCloseRequest, options);
        appBus.on('panel:toggle-collapse-request', me._boundOnToggleCollapseRequest, options);
    }

    /**
     * Event handler for when a child Panel (tab) requests to close.
     * @param {object} eventData
     * @param {Panel} eventData.panel - The child Panel.
     * @param {PanelGroup} eventData.group - The parent PanelGroup.
     * @returns {void}
     */
    onChildCloseRequest({ panel, group }) {
        if (group === this && this._state.panels.includes(panel)) {
            this.removePanel(panel, false);
        }
    }

    /**
     * Event handler for 'app:close-panel-request' from ContextMenu.
     * @param {object} contextData
     * @param {Panel} contextData.panel - The child Panel.
     * @param {PanelGroup} contextData.group - The parent PanelGroup.
     * @returns {void}
     */
    onChildCloseRequestFromContext(contextData) {
        this.onChildCloseRequest(contextData);
    }

    /**
     * Event handler for when this entire PanelGroup requests to close.
     * @param {Panel | PanelGroup} panel
     * @returns {void}
     */
    onCloseRequest(panel) {
        if (panel === this) {
            this.close();
        }
    }

    /**
     * Event handler to toggle the collapse state of this PanelGroup.
     * @param {Panel | PanelGroup} panel
     * @returns {void}
     */
    onToggleCollapseRequest(panel) {
        if (panel === this) {
            this.toggleCollapse();
        }
    }

    /**
     * Cleans up appBus listeners and destroys child components.
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        me._state.header?.destroy();
        me._state.panels.forEach(panel => panel.destroy());
        me.getThrottledUpdate()?.cancel();

        me._resizeHandleSE?.removeEventListener('mousedown', me._boundOnFloatingResizeStart);
        me._resizeHandleS?.removeEventListener('mousedown', me._boundOnFloatingResizeStart);
        me._resizeHandleE?.removeEventListener('mousedown', me._boundOnFloatingResizeStart);
        window.removeEventListener('mousemove', me._boundOnFloatingResizeMove);
        window.removeEventListener('mouseup', me._boundOnFloatingResizeUp);
    }

    /**
     * Builds the component's main DOM structure.
     * @returns {void}
     */
    build() {
        const me = this;
        me.resizeHandle = document.createElement('div');
        me.resizeHandle.classList.add('panel-group__resize-handle');
        me.resizeHandle.addEventListener('mousedown', me.startResize.bind(me));

        me.element.append(
            me._state.header.element,
            me._state.contentContainer,
            me.resizeHandle,
            me._resizeHandleSE,
            me._resizeHandleS,
            me._resizeHandleE
        );

        if (!me._state.movable) {
            me.element.classList.add('panel--not-movable');
        }

        me.updateCollapse();
    }

    /**
     * Gets the panel type identifier.
     * @returns {string}
     */
    getPanelType() {
        return 'PanelGroup';
    }

    /**
     * Checks if this panel group is allowed to collapse.
     * @returns {boolean}
     */
    canCollapse() {
        const me = this;
        if (me._state.isFloating) {
            return me._state.collapsible;
        }
        if (!me._state.column) return false;
        if (!me._state.collapsible) return false;

        const uncollapsedGroups = me._state.column.getPanelGroupsUncollapsed();
        return uncollapsedGroups.length > 1 || me._state.collapsed;
    }

    /**
     * Toggles the collapse state and requests a layout update.
     * @returns {void}
     */
    toggleCollapse() {
        const me = this;
        if (me._state.collapsed) {
            me.unCollapse();
        } else {
            if (!me.canCollapse()) {
                return;
            }
            me.collapse();
        }

        me.requestLayoutUpdate();
    }

    /**
     * Applies the correct visibility state based on the internal state.
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
     * @returns {void}
     */
    collapse() {
        const me = this;
        me._state.collapsed = true;
        me.element.classList.add('panel--collapsed');
        me._state.contentContainer.style.display = 'none';
        me.resizeHandle.style.display = 'none';
        me.updateHeight();
    }

    /**
     * Shows the content and removes collapsed styles.
     * @returns {void}
     */
    unCollapse() {
        const me = this;
        me._state.collapsed = false;
        me.element.classList.remove('panel--collapsed');
        me._state.contentContainer.style.display = '';
        me.resizeHandle.style.display = '';
        me.updateHeight();
    }

    /**
     * Closes the entire PanelGroup and notifies its parent Column.
     * @returns {void}
     */
    close() {
        const me = this;
        if (!me._state.closable) return;

        appBus.emit('panelgroup:removed', { panel: me, column: me._state.column });
        me.destroy();
    }

    /**
     * Updates the CSS height/flex properties based on the current state.
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
     * Handles the start of a vertical resize drag for this PanelGroup.
     * @param {MouseEvent} e - The mousedown event.
     * @returns {void}
     */
    startResize(e) {
        e.preventDefault();
        const me = this;
        const startY = e.clientY;
        const startH = me.element.offsetHeight;

        const minPanelHeight = me.getMinPanelHeight();

        const onMove = ev => {
            const delta = ev.clientY - startY;
            me._state.height = Math.max(minPanelHeight, startH + delta);
            me.getThrottledUpdate()();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('mouseleave', onUp);

            me.getThrottledUpdate()?.cancel();
            me.requestLayoutUpdate();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('mouseleave', onUp);
    }

    /**
     * Updates the header's visual mode (simple vs. tabs).
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
     * @param {Panel} panel - The panel instance to remove.
     * @param {boolean} [isMoving=false] - If true, panel is not destroyed (DND).
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
     * Description:
     * Moves an existing Panel (tab) to a new index within this group.
     * Used for drag-and-drop reordering.
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
     * Sets a child Panel (tab) as the active one, showing its content.
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

        me.requestLayoutUpdate();
    }

    /**
     * Emits an event to the LayoutService if this group is attached to a column.
     * @returns {void}
     */
    requestLayoutUpdate() {
        const column = this.getColumn();
        if (column && !this._state.isFloating) {
            appBus.emit('layout:panel-groups-changed', column);
        }
    }

    /**
     * Creates the DOM elements for floating resize handles.
     * @private
     * @returns {void}
     */
    _createFloatingResizeHandles() {
        const me = this;
        me._resizeHandleSE = document.createElement('div');
        me._resizeHandleS = document.createElement('div');
        me._resizeHandleE = document.createElement('div');

        me._resizeHandleSE.className =
            'panel-group__resize-handle--floating panel-group__resize-handle--se';
        me._resizeHandleS.className =
            'panel-group__resize-handle--floating panel-group__resize-handle--s';
        me._resizeHandleE.className =
            'panel-group__resize-handle--floating panel-group__resize-handle--e';

        me._resizeHandleSE.dataset.direction = 'se';
        me._resizeHandleS.dataset.direction = 's';
        me._resizeHandleE.dataset.direction = 'e';
    }

    /**
     * Attaches mousedown listeners to floating resize handles.
     * @private
     * @returns {void}
     */
    _initFloatingResizeListeners() {
        const me = this;
        me._resizeHandleSE.addEventListener('mousedown', me._boundOnFloatingResizeStart);
        me._resizeHandleS.addEventListener('mousedown', me._boundOnFloatingResizeStart);
        me._resizeHandleE.addEventListener('mousedown', me._boundOnFloatingResizeStart);
    }

    /**
     * Handles the start of a floating resize drag.
     * @param {MouseEvent} e
     * @private
     * @returns {void}
     */
    _onFloatingResizeStart(e) {
        const me = this;
        if (!me._state.isFloating) return;

        e.preventDefault();
        e.stopPropagation();

        me._resizeState.startX = e.clientX;
        me._resizeState.startY = e.clientY;
        const rect = me.element.getBoundingClientRect();
        me._resizeState.startWidth = rect.width;
        me._resizeState.startHeight = rect.height;
        me._resizeState.direction = e.target.dataset.direction;

        window.addEventListener('mousemove', me._boundOnFloatingResizeMove);
        window.addEventListener('mouseup', me._boundOnFloatingResizeUp);
    }

    /**
     * Handles mouse movement during floating resize.
     * @param {MouseEvent} e
     * @private
     * @returns {void}
     */
    _onFloatingResizeMove(e) {
        const me = this;
        const deltaX = e.clientX - me._resizeState.startX;
        const deltaY = e.clientY - me._resizeState.startY;

        const fpms = FloatingPanelManagerService.getInstance();
        const bounds = fpms.getContainerBounds();
        if (!bounds) return;

        let newWidth = me._resizeState.startWidth;
        let newHeight = me._resizeState.startHeight;

        const direction = me._resizeState.direction;

        if (direction.includes('e')) {
            newWidth = me._resizeState.startWidth + deltaX;
        }
        if (direction.includes('s')) {
            newHeight = me._resizeState.startHeight + deltaY;
        }

        const minWidth = me.getMinPanelWidth();
        const minHeight = me.getMinPanelHeight();

        const maxWidth = bounds.width - me._state.x;
        const maxHeight = bounds.height - me._state.y;

        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

        if (direction.includes('e')) {
            me.element.style.width = `${newWidth}px`;
        }
        if (direction.includes('s')) {
            me.element.style.height = `${newHeight}px`;
        }
    }

    /**
     * Handles mouse up after floating resize.
     * @param {MouseEvent} e
     * @private
     * @returns {void}
     */
    _onFloatingResizeUp(e) {
        const me = this;
        window.removeEventListener('mousemove', me._boundOnFloatingResizeMove);
        window.removeEventListener('mouseup', me._boundOnFloatingResizeUp);

        me._state.width = me.element.offsetWidth;
        me._state.height = me.element.offsetHeight;
    }

    /**
     * Serializes the PanelGroup state (and its child Panels) to JSON.
     * @returns {object}
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
                minHeight: me._state.minHeight
            },
            panels: me._state.panels.map(panel => panel.toJSON())
        };
    }

    /**
     * Deserializes state from JSON data.
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
