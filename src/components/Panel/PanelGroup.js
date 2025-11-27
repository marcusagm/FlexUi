import { PanelGroupHeader } from './PanelGroupHeader.js';
import { PanelFactory } from './PanelFactory.js';
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { FloatingPanelManagerService } from '../../services/DND/FloatingPanelManagerService.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { ItemType, DropZoneType } from '../../constants/DNDTypes.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { UIElement } from '../../core/UIElement.js';
import { VanillaPanelGroupAdapter } from '../../renderers/vanilla/VanillaPanelGroupAdapter.js';
import { GroupApi } from '../../api/GroupApi.js';

/**
 * Description:
 * Manages a group of Panel (tabs) within a Column. This class acts as an
 * "Orchestrator" for its child Panel components. It manages the active tab state,
 * collapse state, and its own dimensions.
 *
 * It extends UIElement and delegates DOM rendering to VanillaPanelGroupAdapter.
 *
 * Properties summary:
 * - header {PanelGroupHeader} : The header component instance.
 * - panels {Array<Panel>} : The list of child panels.
 * - activePanel {Panel|null} : The currently visible panel.
 * - collapsed {boolean} : Whether the group is collapsed.
 * - height {number|null} : The height of the group.
 * - width {number|null} : The width of the group.
 * - isFloating {boolean} : Whether the group is floating.
 * - isPopout {boolean} : Whether the group is in an external window.
 * - isMaximized {boolean} : Whether the group is maximized.
 * - x {number|null} : X coordinate (if floating).
 * - y {number|null} : Y coordinate (if floating).
 * - minHeight {number} : Minimum height constraint.
 * - minWidth {number} : Minimum width constraint.
 * - closable {boolean} : Whether the group is closable.
 * - collapsible {boolean} : Whether the group is collapsible.
 * - movable {boolean} : Whether the group is movable.
 * - api {GroupApi} : The public API facade.
 *
 * Typical usage:
 * const panel = new TextPanel('Title', 'Content');
 * const group = new PanelGroup(panel);
 * column.addChild(group);
 *
 * Events:
 * - Listens to: EventTypes.PANEL_GROUP_CHILD_CLOSE, EventTypes.APP_CLOSE_PANEL_REQUEST, EventTypes.PANEL_CLOSE_REQUEST, EventTypes.PANEL_TOGGLE_COLLAPSE
 * - Emits: EventTypes.PANEL_GROUP_REMOVED
 * - Emits: EventTypes.LAYOUT_PANELGROUPS_CHANGED
 *
 * Business rules implemented:
 * - Orchestrates Panel DOM (header vs. content).
 * - Manages active tab state via TabStrip in Header.
 * - Manages hybrid resizing (Docked vs Floating).
 * - Coordinates lifecycle of children (Panel and Header).
 * - Supports Popout Mode (external window).
 * - Exposes a GroupApi facade.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaPanelGroupAdapter.js').VanillaPanelGroupAdapter}
 * - {import('./PanelGroupHeader.js').PanelGroupHeader}
 * - {import('./PanelFactory.js').PanelFactory}
 * - {import('../../utils/ResizeHandleManager.js').ResizeHandleManager}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../api/GroupApi.js').GroupApi}
 */
export class PanelGroup extends UIElement {
    /**
     * The public API facade.
     *
     * @type {GroupApi}
     * @private
     */
    _api;

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
     * Whether the group is maximized (primarily for floating state).
     *
     * @type {boolean}
     * @private
     */
    _isMaximized = false;

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
     * Whether the group is in an external popout window.
     *
     * @type {boolean}
     * @private
     */
    _isPopout = false;

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
     * Control flag for the visibility of the resize handle in docked mode.
     *
     * @type {boolean}
     * @private
     */
    _resizeHandleVisible = true;

    /**
     * The drop zone type identifier.
     *
     * @type {string}
     * @public
     */
    dropZoneType = DropZoneType.TAB_CONTAINER;

    /**
     * Creates a new PanelGroup instance.
     *
     * @param {Panel | null} [initialPanel=null] - The optional first panel.
     * @param {number|null} [height=null] - The initial height of the group.
     * @param {boolean} [collapsed=false] - The initial collapsed state.
     * @param {object} [config={}] - Configuration overrides for the group.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer.
     */
    constructor(
        initialPanel = null,
        height = null,
        collapsed = false,
        config = {},
        renderer = null
    ) {
        super(null, renderer || new VanillaPanelGroupAdapter());
        const me = this;

        me._api = new GroupApi(me);

        me._header = new PanelGroupHeader(me);

        if (config.minHeight !== undefined) me._minHeight = config.minHeight;
        if (config.minWidth !== undefined) me._minWidth = config.minWidth;
        if (config.closable !== undefined) me.closable = config.closable;
        if (config.collapsible !== undefined) me.collapsible = config.collapsible;
        if (config.movable !== undefined) me.movable = config.movable;

        if (height !== null) {
            me.height = height;
        }

        me._boundOnChildCloseRequest = me.onChildCloseRequest.bind(me);
        me._boundOnChildCloseRequestFromContext = me.onChildCloseRequestFromContext.bind(me);
        me._boundOnCloseRequest = me.onCloseRequest.bind(me);
        me._boundOnToggleCollapseRequest = me.onToggleCollapseRequest.bind(me);

        me.render();

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
     * Retrieves the public API facade.
     *
     * @returns {GroupApi} The API instance.
     */
    get api() {
        return this._api;
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
     * ContentContainer getter (delegated to renderer).
     *
     * @returns {HTMLElement | null}
     */
    get contentContainer() {
        const me = this;
        if (me.element) {
            return me.renderer.getContentContainer(me.element);
        }
        return null;
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
     * Updates DOM classes via adapter and resizes.
     *
     * @param {boolean} value
     * @returns {void}
     */
    set collapsed(value) {
        const me = this;
        if (typeof value !== 'boolean') return;
        me._collapsed = value;

        if (me.element) {
            me.renderer.setCollapsed(me.element, value);
        }

        const handles = me.element ? me.element.querySelectorAll('.resize-handle') : [];
        handles.forEach(h => {
            h.style.display = value ? 'none' : '';
        });

        me.updateHeight();

        if (me._header) {
            me._header.updateCollapsedState(value);
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

        if (!panel) return;
        if (panel === me._activePanel && me._panels.length > 1) return;

        if (me._activePanel) {
            me._activePanel.setVisible(false);
            me._activePanel.unmount();
        }

        me._activePanel = panel;
        me.title = panel.title;

        if (me._header && me._header.tabStrip) {
            me._header.tabStrip.setActiveItem(panel.header);
        }

        if (me.isMounted && me.contentContainer) {
            panel.mount(me.contentContainer);
        }

        panel.setVisible(true);

        if (me._header) {
            me._header.updateAriaLabels();
        }

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
        if (me._header) {
            me._header.title = value;
        }
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
     * IsPopout getter.
     *
     * @returns {boolean}
     */
    get isPopout() {
        return this._isPopout;
    }

    /**
     * IsMaximized getter.
     *
     * @returns {boolean}
     */
    get isMaximized() {
        return this._isMaximized;
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
        if (value !== null) {
            const num = Number(value);
            if (!Number.isFinite(num) || num < 0) {
                console.warn(
                    `[PanelGroup] invalid height assignment (${value}). Must be a positive number.`
                );
                return;
            }
            me._height = num;
        } else {
            me._height = null;
        }
        me.updateHeight();
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
        if (value !== null) {
            const num = Number(value);
            if (!Number.isFinite(num) || num < 0) {
                console.warn(
                    `[PanelGroup] invalid width assignment (${value}). Must be a positive number.`
                );
                return;
            }
            me._width = num;
        } else {
            me._width = null;
        }
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
     * Closable setter.
     * Propagates config to header.
     *
     * @param {boolean} value
     * @returns {void}
     */
    set closable(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(
                `[PanelGroup] invalid closable assignment (${value}). Must be boolean. Keeping previous value: ${me._closable}`
            );
            return;
        }
        me._closable = value;
        if (me.header) {
            me.header.updateConfig({ closable: value });
        }
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
     * Collapsible setter.
     * Propagates config to header.
     *
     * @param {boolean} value
     * @returns {void}
     */
    set collapsible(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(
                `[PanelGroup] invalid collapsible assignment (${value}). Must be boolean. Keeping previous value: ${me._collapsible}`
            );
            return;
        }
        me._collapsible = value;
        if (me.header) {
            me.header.updateConfig({ collapsible: value });
        }
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
     * Movable setter.
     * Propagates config to header.
     *
     * @param {boolean} value
     * @returns {void}
     */
    set movable(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(
                `[PanelGroup] invalid movable assignment (${value}). Must be boolean. Keeping previous value: ${me._movable}`
            );
            return;
        }
        me._movable = value;
        if (me.header) {
            me.header.updateConfig({ movable: value });
        }
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
     * Implementation of the rendering logic.
     * Uses the adapter to create the group DOM structure.
     *
     * @returns {HTMLElement} The root group element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createGroupElement(me.id);

        element.addEventListener('pointerdown', () => {
            if (me.isFloating) {
                FloatingPanelManagerService.getInstance().bringToFront(me);
            }
        });

        return element;
    }

    /**
     * Implementation of the mounting logic.
     * Mounts header and active panel content.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me.element) {
            if (me.element.parentNode !== container) {
                me.renderer.mount(container, me.element);
            }

            if (me.header) {
                me.header.mount(me.element);
                if (me.header.element) {
                    me.renderer.mountHeader(me.element, me.header.element);
                }
            }

            if (me._activePanel && me.contentContainer) {
                me._activePanel.mount(me.contentContainer);
            }

            me.collapsed = me._collapsed;
            if (me._isFloating) {
                me.setFloatingState(true, me._x, me._y);
            } else if (me._isPopout) {
                me.setPopoutMode(true);
            } else {
                me.setFloatingState(false, null, null);
            }
        }
    }

    /**
     * Implementation of the unmounting logic.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;

        if (me._resizeHandleManager) {
            me._resizeHandleManager.destroy();
            me._resizeHandleManager = null;
        }

        if (me.header && me.header.isMounted) {
            me.header.unmount();
        }

        if (me._activePanel && me._activePanel.isMounted) {
            me._activePanel.unmount();
        }

        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
    }

    /**
     * Sets the floating state and updates the DOM, managing the correct resize handles.
     *
     * @param {boolean} isFloating - Whether the panel should be floating.
     * @param {number|null} x - The initial X coordinate.
     * @param {number|null} y - The initial Y coordinate.
     * @returns {void}
     */
    setFloatingState(isFloating, x, y) {
        const me = this;

        me._resizeHandleManager?.destroy();
        me._resizeHandleManager = null;

        me._isFloating = isFloating;
        me._x = x;
        me._y = y;

        if (me.header) {
            me.header.setCollapseButtonDisabled(!me._collapsible);
        }

        if (me.element) {
            me.renderer.setFloatingMode(me.element, isFloating);

            if (isFloating) {
                me.renderer.updateGeometry(me.element, x, y, me._width, me._height);
            } else {
                me.renderer.updateStyles(me.element, {
                    width: '',
                    height: '',
                    top: '',
                    left: '',
                    position: ''
                });
            }
        }

        if (isFloating) {
            const fpms = FloatingPanelManagerService.getInstance();
            if (me.element) {
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
                        if (me._isMaximized) return;

                        me._x = xCoordinate;
                        me._y = yCoordinate;
                        me._width = width;
                        me._height = height;
                        me.renderer.updateGeometry(
                            me.element,
                            xCoordinate,
                            yCoordinate,
                            width,
                            height
                        );
                        me.updateHeight();
                    }
                });
            }
        } else {
            if (me._isMaximized) me.toggleMaximize();
            me._updateDockedResizeHandle();
        }

        if (me.header) {
            me.header.updateConfig({
                closable: me._closable,
                movable: me._movable,
                collapsible: me._collapsible
            });
        }
    }

    /**
     * Sets the popout mode state (external window).
     * Disables resize handles and hides closable/collapsible buttons.
     * Handles rigorous style reset when disabling.
     *
     * @param {boolean} value - True to enable popout mode.
     * @returns {void}
     */
    setPopoutMode(value) {
        const me = this;
        const isPopout = Boolean(value);
        if (me._isPopout === isPopout) return;

        me._isPopout = isPopout;

        if (me.element) {
            if (isPopout) {
                if (me._resizeHandleManager) {
                    me._resizeHandleManager.destroy();
                    me._resizeHandleManager = null;
                }

                me.renderer.updateStyles(me.element, {
                    width: '100%',
                    height: '100%',
                    position: 'static',
                    left: '',
                    top: '',
                    flex: '1 1 auto'
                });

                if (me.header) {
                    me.header.updateConfig({
                        movable: true,
                        collapsible: false,
                        closable: false
                    });
                    me.header.setPopoutState(true);
                }
            } else {
                me.renderer.updateStyles(me.element, {
                    width: '',
                    height: '',
                    position: '',
                    left: '',
                    top: '',
                    flex: ''
                });

                if (me.header) {
                    me.header.updateConfig({
                        movable: me._movable,
                        collapsible: me._collapsible,
                        closable: me._closable
                    });
                    me.header.setPopoutState(false);
                }
            }
        }

        me.updateHeight();
    }

    /**
     * Updates the docked resize handle state based on visibility and floating status.
     *
     * @private
     * @returns {void}
     */
    _updateDockedResizeHandle() {
        const me = this;
        if (me._isFloating || me._isPopout) return;
        if (!me.element) return;

        if (!me._resizeHandleVisible) {
            if (me._resizeHandleManager) {
                me._resizeHandleManager.destroy();
                me._resizeHandleManager = null;
            }
            return;
        }

        if (!me._resizeHandleManager) {
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

            if (me.collapsed) {
                const handles = me.element.querySelectorAll('.resize-handle');
                handles.forEach(h => {
                    h.style.display = 'none';
                });
            }
        }
    }

    /**
     * Sets whether the resize handle should be visible (used when not floating).
     * Typically controlled by LayoutService (e.g., hide for last item).
     *
     * @param {boolean} visible
     * @returns {void}
     */
    setResizeHandleVisible(visible) {
        const me = this;
        if (typeof visible !== 'boolean') return;
        me._resizeHandleVisible = visible;
        me._updateDockedResizeHandle();
    }

    /**
     * Toggles the maximized state of the group (if floating).
     *
     * @returns {void}
     */
    toggleMaximize() {
        const me = this;
        if (!me._isFloating || !me.element) return;

        me._isMaximized = !me._isMaximized;

        if (me._isMaximized) {
            me.element.classList.add('panel-group--maximized');
        } else {
            me.element.classList.remove('panel-group--maximized');
            me.renderer.updateGeometry(me.element, me._x, me._y, me._width, me._height);
        }
    }

    /**
     * Sets whether the group should fill the available space in the column.
     * Used by LayoutService.
     *
     * @param {boolean} fillsSpace
     * @returns {void}
     */
    setFillSpace(fillsSpace) {
        const me = this;
        if (me.element) {
            me.renderer.setFillSpace(me.element, fillsSpace);
        }
    }

    /**
     * Sets whether the collapse button should be disabled.
     * Used by LayoutService.
     *
     * @param {boolean} disabled
     * @returns {void}
     */
    setCollapseButtonDisabled(disabled) {
        const me = this;
        if (me.header) {
            me.header.setCollapseButtonDisabled(disabled);
        }
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

        if (me._header && me._header.tabStrip) {
            me.addDisposable(
                me._header.tabStrip.onSelectionChange(headerItem => {
                    if (headerItem && headerItem.panel) {
                        if (me.activePanel !== headerItem.panel) {
                            me.activePanel = headerItem.panel;
                        }
                    }
                })
            );
        }
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
        return this._header && this._header.element ? this._header.element.offsetHeight : 0;
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

        me.unmount();

        if (me._header) {
            me._header.dispose();
        }
        me._panels.forEach(panel => panel.dispose());
        me.getThrottledUpdate()?.cancel();

        if (me.element) {
            me.element.remove();
        }
        super.dispose();
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
        if (!me.element) return;

        if (me._isPopout) {
            me.renderer.updateStyles(me.element, {
                height: '100%',
                minHeight: '0',
                flex: '1 1 auto'
            });
            return;
        }

        if (me._collapsed) {
            return;
        }

        if (me._height !== null && !me._isFloating) {
            me.renderer.updateStyles(me.element, {
                height: `${me._height}px`,
                flex: '0 0 auto'
            });
        } else if (!me._isFloating) {
            me.renderer.updateStyles(me.element, {
                height: 'auto',
                flex: '0 0 auto'
            });
        }

        const minH = me.getMinPanelHeight();
        me.renderer.updateStyles(me.element, { minHeight: `${minH}px` });
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
        if (!panel) return;
        if (me._panels.includes(panel)) {
            if (makeActive) me.activePanel = panel;
            return;
        }

        panel.parentGroup = me;

        const safeIndex = index === null ? me._panels.length : index;
        if (safeIndex >= me._panels.length) {
            me._panels.push(panel);
        } else {
            me._panels.splice(safeIndex, 0, panel);
        }

        if (me.header && me.header.tabStrip) {
            me.header.tabStrip.addItem(panel.header, safeIndex);
        }

        if (makeActive || me._panels.length === 1) {
            me.activePanel = panel;
        } else {
            panel.setVisible(false);
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
            me.addPanel(panel, null, false);
        });
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

        if (me.header && me.header.tabStrip) {
            me.header.tabStrip.removeItem(panel.header);
        }

        if (panel.isMounted) {
            panel.unmount();
        }

        if (!isMoving) {
            panel.dispose();
        }

        me._panels.splice(index, 1);
        panel.parentGroup = null;

        if (me._panels.length === 0) {
            me.close();
            return;
        }

        if (panel === me._activePanel) {
            const newActive = me._panels[index] || me._panels[index - 1];
            me.activePanel = newActive;
        } else {
            me.requestLayoutUpdate();
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
        if (oldIndex === -1) return;
        if (oldIndex === newIndex) return;

        me._panels.splice(oldIndex, 1);
        const adjustedIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
        me._panels.splice(adjustedIndex, 0, panel);

        if (me.header && me.header.tabStrip) {
            me.header.tabStrip.removeItem(panel.header);
            me.header.tabStrip.addItem(panel.header, adjustedIndex);
        }
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
            maximized: me._isMaximized,
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
            if (data.config.closable !== undefined) me.closable = data.config.closable;
            if (data.config.collapsible !== undefined) me.collapsible = data.config.collapsible;
            if (data.config.movable !== undefined) me.movable = data.config.movable;
            if (data.config.minHeight !== undefined) me._minHeight = data.config.minHeight;
            if (data.config.minWidth !== undefined) me._minWidth = data.config.minWidth;
        }

        if (me.isFloating) {
            me.setFloatingState(true, me.x, me.y);
            if (data.maximized) me.toggleMaximize();
        } else {
            me.setFloatingState(false, null, null);
        }

        me._retorePanels(data);

        if (data.collapsed !== undefined) me.collapsed = data.collapsed;
        me.updateHeight();
    }

    /**
     * Reatore panels from JSON data
     *
     * @param {*} data
     * @returns {void}
     */
    _retorePanels(data) {
        const me = this;
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

        if (panelInstances.length > 0) {
            me.addPanelsBulk(panelInstances);
            if (!activePanelInstance) activePanelInstance = panelInstances[0];
            me.activePanel = activePanelInstance;
        }
    }
}
