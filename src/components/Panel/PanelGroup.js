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
 * - element {HTMLElement} : The main DOM element (<div class="panel-group">).
 * - panels {Array<Panel>} : The list of child panels.
 * - activePanel {Panel|null} : The currently visible panel.
 * - collapsed {boolean} : Whether the group is collapsed.
 * - height {number|null} : The height of the group.
 * - width {number|null} : The width of the group.
 * - isFloating {boolean} : Whether the group is floating.
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
 * Business rules implemented:
 * - Orchestrates Panel DOM (header vs. content).
 * - Manages active tab state ('setActive').
 * - Renders in "simple mode" (no tabs) if only one child Panel exists.
 * - Manages its own vertical resize (docked) and 2D resize (floating) via ResizeController.
 * - If last Panel is removed, destroys itself ('removePanel' -> 'close').
 * - Calculates minHeight dynamically based on panel content and resize handle visibility.
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
 *
 * Notes / Additional:
 * - The group acts as a Tab Container.
 */
export class PanelGroup {
    /**
     * Unique ID for this PanelGroup instance.
     *
     * @type {string}
     * @public
     */
    _id = generateId();

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
     * Reference to the parent Column.
     *
     * @type {import('../Column/Column.js').Column | null}
     * @private
     */
    _column = null;

    /**
     * The header component instance.
     *
     * @type {PanelGroupHeader | null}
     * @private
     */
    _header = null;

    /**
     * The container element for panels content.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _contentContainer = null;

    /**
     * List of child panels.
     *
     * @type {Array<Panel>}
     * @private
     */
    _panels = [];

    /**
     * The currently active panel.
     *
     * @type {Panel | null}
     * @private
     */
    _activePanel = null;

    /**
     * Whether the group is collapsed.
     *
     * @type {boolean}
     * @private
     */
    _collapsed = false;

    /**
     * Height of the group.
     *
     * @type {number | null}
     * @private
     */
    _height = null;

    /**
     * Width of the group.
     *
     * @type {number | null}
     * @private
     */
    _width = null;

    /**
     * Minimum height.
     *
     * @type {number}
     * @private
     */
    _minHeight = 10;

    /**
     * Minimum width.
     *
     * @type {number}
     * @private
     */
    _minWidth = 150;

    /**
     * Whether the group is closable.
     *
     * @type {boolean}
     * @private
     */
    _closable = true;

    /**
     * Whether the group is collapsible.
     *
     * @type {boolean}
     * @private
     */
    _collapsible = true;

    /**
     * Whether the group is movable.
     *
     * @type {boolean}
     * @private
     */
    _movable = true;

    /**
     * The current title of the group (usually from active panel).
     *
     * @type {string | null}
     * @private
     */
    _title = null;

    /**
     * Whether the group is floating.
     *
     * @type {boolean}
     * @private
     */
    _isFloating = false;

    /**
     * X coordinate (if floating).
     *
     * @type {number | null}
     * @private
     */
    _x = null;

    /**
     * Y coordinate (if floating).
     *
     * @type {number | null}
     * @private
     */
    _y = null;

    /**
     * The unified manager for all resize handles.
     *
     * @type {ResizeHandleManager | null}
     * @private
     */
    _resizeHandleManager = null;

    /**
     * Bound handler for the children close request event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnChildCloseRequest = null;

    /**
     * Bound handler for the context close request event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnChildCloseRequestFromContext = null;

    /**
     * Bound handler for the close request event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnCloseRequest = null;

    /**
     * Bound handler for the collapse request event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnToggleCollapseRequest = null;

    /**
     * @param {Panel | null} [initialPanel=null] - The optional first panel.
     * @param {number|null} [height=null] - The initial height of the group.
     * @param {boolean} [collapsed=false] - The initial collapsed state.
     * @param {object} [config={}] - Configuration overrides for the group.
     */
    constructor(initialPanel = null, height = null, collapsed = false, config = {}) {
        const me = this;

        if (config.minHeight !== undefined) me._minHeight = config.minHeight;
        if (config.minWidth !== undefined) me._minWidth = config.minWidth;
        if (config.closable !== undefined) me._closable = config.closable;
        if (config.collapsible !== undefined) me._collapsible = config.collapsible;
        if (config.movable !== undefined) me._movable = config.movable;

        me.dropZoneType = DropZoneType.TAB_CONTAINER;

        me._contentContainer = document.createElement('div');
        me._contentContainer.classList.add('panel-group__content');

        me.element = document.createElement('div');
        me.element.classList.add('panel-group');
        me.element.classList.add('panel');

        me.element.addEventListener('pointerdown', () => {
            if (me.isFloating) {
                FloatingPanelManagerService.getInstance().bringToFront(me);
            }
        });

        me._header = new PanelGroupHeader(me);

        if (height !== null) {
            me.height = height;
        }

        me._boundOnChildCloseRequest = me.onChildCloseRequest.bind(me);
        me._boundOnChildCloseRequestFromContext = me.onChildCloseRequestFromContext.bind(me);
        me._boundOnCloseRequest = me.onCloseRequest.bind(me);
        me._boundOnToggleCollapseRequest = me.onToggleCollapseRequest.bind(me);

        me.build();

        if (config.isFloating) {
            me.setFloatingState(true, config.x, config.y);
        } else {
            me.setFloatingState(false, null, null);
        }

        me.collapsed = collapsed;

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
     * Id getter.
     *
     * @returns {string}
     */
    get id() {
        return this._id;
    }

    /**
     * Header getter.
     *
     * @returns {PanelGroupHeader}
     */
    get header() {
        return this._header;
    }

    /**
     * ContentContainer getter.
     *
     * @returns {HTMLElement}
     */
    get contentContainer() {
        return this._contentContainer;
    }

    /**
     * Panels getter.
     *
     * @returns {Array<Panel>}
     */
    get panels() {
        return this._panels;
    }

    /**
     * Collapsed getter.
     *
     * @returns {boolean}
     */
    get collapsed() {
        return this._collapsed;
    }

    /**
     * Collapsed setter.
     * Updates DOM classes, visibility of content, and resize handles.
     *
     * @param {boolean} value
     * @returns {void}
     */
    set collapsed(value) {
        const me = this;
        if (typeof value !== 'boolean') return;
        me._collapsed = value;

        const handles = me.element.querySelectorAll('.resize-handle');

        if (value) {
            me.element.classList.add('panel--collapsed');
            me._contentContainer.style.display = 'none';
            handles.forEach(h => (h.style.display = 'none'));
        } else {
            me.element.classList.remove('panel--collapsed');
            me._contentContainer.style.display = '';
            handles.forEach(h => (h.style.display = ''));
        }

        me.updateHeight();

        if (me._header && me._header.collapseBtn) {
            if (value) {
                me._header.collapseBtn.classList.add('panel-group__collapse-btn--collapsed');
            } else {
                me._header.collapseBtn.classList.remove('panel-group__collapse-btn--collapsed');
            }
        }
    }

    /**
     * ActivePanel getter.
     *
     * @returns {Panel|null}
     */
    get activePanel() {
        return this._activePanel;
    }

    /**
     * ActivePanel setter.
     * Manages panel visibility, mounting, and header updates.
     *
     * @param {Panel|null} panel
     * @returns {void}
     */
    set activePanel(panel) {
        const me = this;

        const isSimpleMode = me._panels.length === 1;

        if (!panel) return;
        if (panel === me._activePanel && !isSimpleMode) return;

        if (me._activePanel) {
            me._activePanel.unmount();
        }

        me._panels.forEach(p => {
            p.header.element.classList.remove('panel-group__tab--active');
            p.contentElement.style.display = 'none';
        });

        if (!isSimpleMode) {
            panel.header.element.classList.add('panel-group__tab--active');
        }
        panel.contentElement.style.display = '';

        me._activePanel = panel;
        me.title = panel.title;

        if (me._header) {
            me._header.updateAriaLabels();
        }

        panel.mount();
        me.updateHeight();
    }

    /**
     * Title getter.
     *
     * @returns {string|null}
     */
    get title() {
        return this._title;
    }

    /**
     * Title setter.
     *
     * @param {string|null} value
     */
    set title(value) {
        const me = this;
        if (value !== null && typeof value !== 'string') {
            console.warn(
                `[PanelGroup] Invalid title assignment (${value}). Must be a string or null.`
            );
            return;
        }
        me._title = value;
    }

    /**
     * IsFloating getter.
     *
     * @returns {boolean}
     */
    get isFloating() {
        return this._isFloating;
    }

    /**
     * Column getter.
     *
     * @returns {import('../Column/Column.js').Column | null}
     */
    get column() {
        return this._column;
    }

    /**
     * Height getter.
     *
     * @returns {number|null}
     */
    get height() {
        return this._height;
    }

    /**
     * Height setter.
     *
     * @param {number|null} value
     */
    set height(value) {
        const me = this;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            console.warn(
                `[PanelGroup] invalid height assignment (${value}). Must be a positive number.`
            );
            return;
        }
        me._height = value;
    }

    /**
     * Width getter.
     *
     * @returns {number|null}
     */
    get width() {
        return this._width;
    }

    /**
     * Width setter.
     *
     * @param {number|null} value
     */
    set width(value) {
        const me = this;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
            console.warn(
                `[PanelGroup] invalid width assignment (${value}). Must be a positive number.`
            );
            return;
        }
        me._width = value;
    }

    /**
     * X coordinate getter.
     *
     * @returns {number|null}
     */
    get x() {
        return this._x;
    }

    /**
     * Y coordinate getter.
     *
     * @returns {number|null}
     */
    get y() {
        return this._y;
    }

    /**
     * MinHeight getter.
     *
     * @returns {number}
     */
    get minHeight() {
        return this._minHeight;
    }

    /**
     * MinWidth getter.
     *
     * @returns {number}
     */
    get minWidth() {
        return this._minWidth;
    }

    /**
     * Closable getter.
     *
     * @returns {boolean}
     */
    get closable() {
        return this._closable;
    }

    /**
     * Collapsible getter.
     *
     * @returns {boolean}
     */
    get collapsible() {
        return this._collapsible;
    }

    /**
     * Movable getter.
     *
     * @returns {boolean}
     */
    get movable() {
        return this._movable;
    }

    /**
     * ThrottledUpdate setter.
     *
     * @param {Function} func
     */
    setThrottledUpdate(func) {
        this._throttledUpdate = func;
    }

    /**
     * ThrottledUpdate getter.
     *
     * @returns {Function|null}
     */
    getThrottledUpdate() {
        return this._throttledUpdate;
    }

    /**
     * Sets the parent column.
     *
     * @param {import('../Column/Column.js').Column} column
     */
    setParentColumn(column) {
        this._column = column;
    }

    /**
     * Gets the parent column (alias for property getter for compatibility).
     *
     * @returns {import('../Column/Column.js').Column | null}
     */
    getColumn() {
        return this._column;
    }

    /**
     * Sets the floating state and updates the DOM, managing the correct resize handles.
     * This method acts as a coordinator for floating state properties.
     *
     * @param {boolean} isFloating - Whether the panel should be floating.
     * @param {number|null} x - The initial X coordinate (relative to container).
     * @param {number|null} y - The initial Y coordinate (relative to container).
     * @returns {void}
     */
    setFloatingState(isFloating, x, y) {
        const me = this;

        me._resizeHandleManager?.destroy();
        me._resizeHandleManager = null;

        me._isFloating = isFloating;
        me._x = x;
        me._y = y;

        if (me._header && me._header.collapseBtn) {
            me._header.collapseBtn.disabled = !me._collapsible;
        }

        if (isFloating) {
            me.element.classList.add('panel-group--floating');
            me.element.classList.remove('panel-group--fills-space');

            me.element.style.left = `${x}px`;
            me.element.style.top = `${y}px`;
            if (me._width !== null) {
                me.element.style.width = `${me._width}px`;
            }
            if (me._height !== null) {
                me.element.style.height = `${me._height}px`;
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
                    containerRectangle: fpms.getContainerBounds()
                }),
                onResize: ({ xCoordinate, yCoordinate, width, height }) => {
                    me.element.style.left = `${xCoordinate}px`;
                    me.element.style.top = `${yCoordinate}px`;
                    me.element.style.width = `${width}px`;
                    me.element.style.height = `${height}px`;

                    me._x = xCoordinate;
                    me._y = yCoordinate;
                    me._width = width;
                    me._height = height;

                    me.updateHeight();
                }
            });
        } else {
            me.element.classList.remove('panel-group--floating');
            me.element.style.left = '';
            me.element.style.top = '';
            me.element.style.width = '';
            me.element.style.height = '';

            if (me._collapsible) {
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
                        me._height = height;
                        me.getThrottledUpdate()();
                    },
                    onEnd: () => me.requestLayoutUpdate()
                });
            }
        }
        me._updateHeaderMode();
    }

    /**
     * Initializes appBus event listeners.
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
     * Handler for child panel close request.
     *
     * @param {object} eventData
     * @returns {void}
     */
    onChildCloseRequest({ panel, group }) {
        if (group === this && this._panels.includes(panel)) {
            this.removePanel(panel, false);
        }
    }

    /**
     * Handler for context menu close request.
     *
     * @param {object} contextData
     * @returns {void}
     */
    onChildCloseRequestFromContext(contextData) {
        this.onChildCloseRequest(contextData);
    }

    /**
     * Handler for group close request.
     *
     * @param {PanelGroup} panel
     * @returns {void}
     */
    onCloseRequest(panel) {
        if (panel === this) {
            this.close();
        }
    }

    /**
     * Handler for toggle collapse request.
     *
     * @param {PanelGroup} panel
     * @returns {void}
     */
    onToggleCollapseRequest(panel) {
        if (panel === this) {
            this.toggleCollapse();
        }
    }

    /**
     * HeaderHeight getter.
     *
     * @returns {number}
     */
    getHeaderHeight() {
        return this._header ? this._header.element.offsetHeight : 0;
    }

    /**
     * MinPanelHeight getter.
     *
     * @returns {number}
     */
    getMinPanelHeight() {
        const me = this;
        const headerHeight = me.getHeaderHeight();
        const activeMinHeight = me._activePanel ? me._activePanel.minHeight : 0;
        return Math.max(me._minHeight, activeMinHeight) + headerHeight;
    }

    /**
     * MinPanelWidth getter.
     *
     * @returns {number}
     */
    getMinPanelWidth() {
        const me = this;
        const activeMin = me._activePanel ? me._activePanel.minWidth : 0;
        return Math.max(me._minWidth, activeMin);
    }

    /**
     * Cleans up and destroys the group.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        me._header?.destroy();
        me._panels.forEach(panel => panel.destroy());
        me.getThrottledUpdate()?.cancel();

        me._resizeHandleManager?.destroy();

        me.element.remove();
    }

    /**
     * Builds the DOM structure.
     *
     * @returns {void}
     */
    build() {
        const me = this;
        me.element.append(me._header.element, me._contentContainer);

        if (!me._movable) {
            me.element.classList.add('panel--not-movable');
        }
        me.collapsed = me._collapsed;
    }

    /**
     * Returns the panel type identifier.
     *
     * @returns {string}
     */
    getPanelType() {
        return ItemType.PANEL_GROUP;
    }

    /**
     * Toggles collapse state.
     *
     * @returns {void}
     */
    toggleCollapse() {
        const me = this;
        me.collapsed = !me.collapsed;
        me.requestLayoutUpdate();
    }

    /**
     * Helper to apply visibility state.
     *
     * @returns {void}
     */
    updateCollapse() {
        this.collapsed = this._collapsed;
    }

    /**
     * Explicit collapse method.
     *
     * @returns {void}
     */
    collapse() {
        this.collapsed = true;
    }

    /**
     * Explicit uncollapse method.
     *
     * @returns {void}
     */
    unCollapse() {
        this.collapsed = false;
    }

    /**
     * Closes the group.
     *
     * @returns {void}
     */
    close() {
        const me = this;
        if (!me._closable) return;
        appBus.emit(EventTypes.PANEL_GROUP_REMOVED, { panel: me, column: me._column });
        me.destroy();
    }

    /**
     * Updates the height styles based on state.
     *
     * @returns {void}
     */
    updateHeight() {
        const me = this;
        if (me._collapsed) {
            me.element.style.height = 'auto';
            me.element.style.flex = '0 0 auto';
            me.element.classList.add('panel--collapsed');
            me.element.style.minHeight = 'auto';

            if (me._header) {
                me._header.updateScrollButtons();
            }
            return;
        }

        me.element.classList.remove('panel--collapsed');

        const minPanelHeight = me.getMinPanelHeight();
        me.element.style.minHeight = `${minPanelHeight}px`;

        if (me._height !== null && !me._isFloating) {
            me.element.style.height = `${me._height}px`;
            me.element.style.flex = '0 0 auto';
        } else if (!me._isFloating) {
            me.element.style.height = 'auto';
            me.element.style.flex = '0 0 auto';
        }

        if (me._header) {
            me._header.updateScrollButtons();
        }
    }

    /**
     * Updates the header mode (tabs vs simple).
     *
     * @private
     * @returns {void}
     */
    _updateHeaderMode() {
        const me = this;
        if (!me._header) return;

        const isSimpleMode = me._panels.length === 1;
        me._header.element.classList.toggle('panel-group__header--simple', isSimpleMode);

        if (isSimpleMode && me._panels.length === 1) {
            const panel = me._panels[0];
            me._header.collapseBtn.style.display =
                panel.collapsible && me._collapsible ? '' : 'none';
            me._header.closeBtn.style.display = panel.closable && me._closable ? '' : 'none';
            me._header.moveHandle.style.display = panel.movable && me._movable ? '' : 'none';
        } else {
            me._header.collapseBtn.style.display = me._collapsible ? '' : 'none';
            me._header.closeBtn.style.display = me._closable ? '' : 'none';
            me._header.moveHandle.style.display = me._movable ? '' : 'none';
        }
    }

    /**
     * Adds a panel to the group.
     *
     * @param {Panel} panel
     * @param {number|null} [index=null]
     * @param {boolean} [makeActive=false]
     * @returns {void}
     */
    addPanel(panel, index = null, makeActive = false) {
        const me = this;
        if (!panel || !(panel instanceof Panel)) {
            console.warn('PanelGroup.addPanel: item is not an instance of Panel.', panel);
            return;
        }
        if (me._panels.includes(panel)) {
            if (makeActive) me.activePanel = panel;
            return;
        }

        const currentCount = me._panels.length;
        if (currentCount === 0) {
            panel.header.setMode(true);
        } else if (currentCount === 1) {
            me._panels[0].header.setMode(false);
            panel.header.setMode(false);
        } else {
            panel.header.setMode(false);
        }

        panel.parentGroup = me;
        me._contentContainer.appendChild(panel.contentElement);

        const tabContainer = me._header.tabContainer;
        const tabElement = panel.header.element;
        const safeIndex = index === null ? me._panels.length : index;

        if (safeIndex >= me._panels.length) {
            me._panels.push(panel);
            tabContainer.appendChild(tabElement);
        } else {
            me._panels.splice(safeIndex, 0, panel);
            const nextSiblingPanel = me._panels[safeIndex + 1];
            const nextSiblingTabElement = nextSiblingPanel ? nextSiblingPanel.header.element : null;
            tabContainer.insertBefore(tabElement, nextSiblingTabElement);
        }

        me._updateHeaderMode();
        me._header.updateScrollButtons();

        if (makeActive || me._panels.length === 1) {
            me.activePanel = panel;
        } else {
            panel.contentElement.style.display = 'none';
            me.requestLayoutUpdate();
        }
    }

    /**
     * Bulk adds panels.
     *
     * @param {Array<Panel>} panels
     * @returns {void}
     */
    addPanelsBulk(panels) {
        const me = this;
        if (!panels || panels.length === 0) return;

        panels.forEach(panel => {
            panel.header.setMode(false);
            panel.parentGroup = me;
            me._header.tabContainer.appendChild(panel.header.element);
            me._contentContainer.appendChild(panel.contentElement);
            panel.contentElement.style.display = 'none';
        });
        me._panels.push(...panels);
    }

    /**
     * Removes a panel from the group.
     *
     * @param {Panel} panel
     * @param {boolean} [isMoving=false]
     * @returns {void}
     */
    removePanel(panel, isMoving = false) {
        const me = this;
        const index = me._panels.indexOf(panel);
        if (index === -1) return;

        if (!isMoving) {
            panel.destroy();
        }

        panel.header.element.classList.remove('panel-group__tab--active');
        panel.header.element.remove();
        panel.contentElement.remove();

        me._panels.splice(index, 1);
        panel.parentGroup = null;

        const newCount = me._panels.length;
        if (newCount === 1) {
            const remaining = me._panels[0];
            remaining.header.setMode(true);
            me.activePanel = remaining;
        }

        me._updateHeaderMode();
        me._header.updateScrollButtons();

        if (me._panels.length === 0) {
            me.close();
            return;
        }

        if (panel === me._activePanel) {
            const newActive = me._panels[index] || me._panels[index - 1];
            me.activePanel = newActive;
        } else {
            if (newCount > 1) me.requestLayoutUpdate();
        }
    }

    /**
     * Moves a panel to a new index.
     *
     * @param {Panel} panel
     * @param {number} newIndex
     * @returns {void}
     */
    movePanel(panel, newIndex) {
        const me = this;
        if (!panel || newIndex < 0) return;

        const oldIndex = me._panels.indexOf(panel);
        if (oldIndex === -1) {
            console.warn('PanelGroup.movePanel: Panel not found in this group.');
            return;
        }
        if (oldIndex === newIndex) return;

        me._panels.splice(oldIndex, 1);
        const adjustedIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
        me._panels.splice(adjustedIndex, 0, panel);

        const tabContainer = me._header.tabContainer;
        const tabElement = panel.header.element;
        const nextSiblingPanel = me._panels[adjustedIndex + 1];
        const nextSiblingTabElement = nextSiblingPanel ? nextSiblingPanel.header.element : null;

        tabContainer.insertBefore(tabElement, nextSiblingTabElement);
        me._header.updateScrollButtons();
    }

    /**
     * Notifies layout service of changes.
     *
     * @returns {void}
     */
    requestLayoutUpdate() {
        if (this._column && !this._isFloating) {
            appBus.emit(EventTypes.LAYOUT_PANELGROUPS_CHANGED, this._column);
        }
    }

    /**
     * Serializes state to JSON.
     *
     * @returns {object}
     */
    toJSON() {
        const me = this;
        return {
            type: me.getPanelType(),
            height: me.height,
            width: me.width,
            collapsed: me.collapsed,
            activePanelId: me.activePanel ? me.activePanel.id : null,
            isFloating: me.isFloating,
            x: me.x,
            y: me.y,
            config: {
                closable: me.closable,
                collapsible: me.collapsible,
                movable: me.movable,
                minHeight: me.minHeight,
                minWidth: me.minWidth
            },
            panels: me.panels.map(panel => panel.toJSON())
        };
    }

    /**
     * Deserializes state from JSON.
     *
     * @param {object} data
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        if (data.height !== undefined) me.height = data.height;
        if (data.width !== undefined) me.width = data.width;
        if (data.isFloating !== undefined) me._isFloating = data.isFloating;
        if (data.x !== undefined) me._x = data.x;
        if (data.y !== undefined) me._y = data.y;
        if (data.config) {
            if (data.config.closable !== undefined) me._closable = data.config.closable;
            if (data.config.collapsible !== undefined) me._collapsible = data.config.collapsible;
            if (data.config.movable !== undefined) me._movable = data.config.movable;
            if (data.config.minHeight !== undefined) me._minHeight = data.config.minHeight;
            if (data.config.minWidth !== undefined) me._minWidth = data.config.minWidth;
        }

        if (me.isFloating) {
            me.setFloatingState(true, me.x, me.y);
        } else {
            me.setFloatingState(false, null, null);
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
            if (!activePanelInstance) activePanelInstance = panelInstances[0];
            if (activePanelInstance) me.activePanel = activePanelInstance;
        }

        if (data.collapsed !== undefined) me.collapsed = data.collapsed;
        me.updateHeight();
    }
}
