import { ApplicationWindowHeader } from './ApplicationWindowHeader.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { ItemType } from '../../constants/DNDTypes.js';
import { UIElement } from '../../core/UIElement.js';
import { VanillaWindowAdapter } from '../../renderers/vanilla/VanillaWindowAdapter.js';
import { WindowApi } from '../../api/WindowApi.js';

/**
 * Description:
 * A standalone component representing a floating window within the application Viewport.
 * It manages its own lifecycle, geometry, and state (maximized, minimized, pinned) as a
 * controller, delegating DOM rendering and styling to an adapter (VanillaWindowAdapter).
 *
 * Properties summary:
 * - title {string} : The window title.
 * - x {number} : X coordinate relative to parent.
 * - y {number} : Y coordinate relative to parent.
 * - width {number} : Window width in pixels.
 * - height {number} : Window height in pixels.
 * - minWidth {number} : Minimum width constraint.
 * - minHeight {number} : Minimum height constraint.
 * - isFocused {boolean} : Focused state flag.
 * - isMaximized {boolean} : Maximized state flag.
 * - isMinimized {boolean} : Minimized state flag.
 * - isPinned {boolean} : Pinned (always on top) state flag.
 * - isTabbed {boolean} : Tabbed (docked) state flag.
 * - header {ApplicationWindowHeader} : The window header component.
 * - contentElement {HTMLElement|null} : The container for window content.
 * - api {WindowApi} : The public API facade.
 *
 * Typical usage:
 * const win = new ApplicationWindow('My Window', contentNode, { x: 100, y: 100 });
 * viewport.addWindow(win);
 *
 * Events:
 * - Emits (appBus): EventTypes.WINDOW_FOCUS, EventTypes.WINDOW_CLOSE_REQUEST, EventTypes.WINDOW_MOUNT
 *
 * Business rules implemented:
 * - Extends UIElement -> Disposable.
 * - Delegates visual operations to VanillaWindowAdapter.
 * - Manages 8-direction resizing via ResizeHandleManager.
 * - Intercepts close requests via `preventClose` (async support).
 * - Identifies as `ItemType.APPLICATION_WINDOW` for DND.
 * - Exposes a WindowApi facade.
 *
 * Dependencies:
 * - UIElement
 * - VanillaWindowAdapter
 * - ApplicationWindowHeader
 * - ResizeHandleManager
 * - EventBus
 * - WindowApi
 */
export class ApplicationWindow extends UIElement {
    /**
     * The public API facade.
     *
     * @type {WindowApi}
     * @private
     */
    _api;

    /**
     * The window header component.
     *
     * @type {ApplicationWindowHeader}
     * @public
     */
    header;

    /**
     * The window title.
     *
     * @type {string}
     * @private
     */
    _title = '';

    /**
     * X coordinate relative to parent.
     *
     * @type {number}
     * @private
     */
    _x = 0;

    /**
     * Y coordinate relative to parent.
     *
     * @type {number}
     * @private
     */
    _y = 0;

    /**
     * Window width in pixels.
     *
     * @type {number}
     * @private
     */
    _width = 400;

    /**
     * Window height in pixels.
     *
     * @type {number}
     * @private
     */
    _height = 300;

    /**
     * Minimum width constraint.
     *
     * @type {number}
     * @public
     */
    minWidth = 200;

    /**
     * Minimum height constraint.
     *
     * @type {number}
     * @public
     */
    minHeight = 150;

    /**
     * Focused state flag.
     *
     * @type {boolean}
     * @private
     */
    _isFocused = false;

    /**
     * Maximized state flag.
     *
     * @type {boolean}
     * @private
     */
    _isMaximized = false;

    /**
     * Minimized state flag.
     *
     * @type {boolean}
     * @private
     */
    _isMinimized = false;

    /**
     * Pinned (always on top) state flag.
     *
     * @type {boolean}
     * @private
     */
    _isPinned = false;

    /**
     * Tabbed (docked) state flag.
     *
     * @type {boolean}
     * @private
     */
    _isTabbed = false;

    /**
     * Geometry snapshot before maximization.
     *
     * @type {{x: number, y: number, width: number, height: number} | null}
     * @private
     */
    _preMaximizeState = null;

    /**
     * Handles 8-way resizing.
     *
     * @type {ResizeHandleManager|null}
     * @private
     */
    _resizeHandleManager = null;

    /**
     * Callback to validate closing.
     *
     * @type {Function|null}
     * @private
     */
    _canCloseHandler = null;

    /**
     * Creates an instance of ApplicationWindow.
     *
     * @param {string} [title='Window'] - The window title.
     * @param {HTMLElement|object|string|null} [content=null] - The initial content.
     * @param {object} [config={}] - Configuration options (x, y, width, height).
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(title = 'Window', content = null, config = {}, renderer = null) {
        super(null, renderer || new VanillaWindowAdapter());
        const me = this;

        me._api = new WindowApi(me);

        me._title = title;

        if (config.x !== undefined) me._x = config.x;
        if (config.y !== undefined) me._y = config.y;
        if (config.width !== undefined) me._width = config.width;
        if (config.height !== undefined) me._height = config.height;
        if (config.minWidth !== undefined) me.minWidth = config.minWidth;
        if (config.minHeight !== undefined) me.minHeight = config.minHeight;

        // Initialize Header (Dependent on 'me' instance)
        me.header = new ApplicationWindowHeader(me, me._title);

        // Ensure element is created via render lifecycle
        me.render();

        if (content) {
            me.setContent(content);
        }

        // Apply initial styles to the rendered element
        me._updateGeometryStyles();
    }

    /**
     * Retrieves the public API facade.
     *
     * @returns {WindowApi} The API instance.
     */
    get api() {
        return this._api;
    }

    /**
     * Returns the type identifier for DND integration.
     *
     * @returns {string} The type string.
     */
    getPanelType() {
        return ItemType.APPLICATION_WINDOW;
    }

    /**
     * Retrieves the content DOM element.
     * Delegates to the renderer to find the correct container within the window structure.
     *
     * @returns {HTMLElement | null} The content container.
     */
    get contentElement() {
        const me = this;
        if (me.element) {
            return me.renderer.getContentElement(me.element);
        }
        return null;
    }

    /**
     * Title getter.
     *
     * @returns {string}
     */
    get title() {
        return this._title;
    }

    /**
     * Title setter. Updates header.
     *
     * @param {string} value
     */
    set title(value) {
        const me = this;
        me._title = value;
        if (me.header) {
            me.header.setTitle(value);
        }
    }

    /**
     * X coordinate getter.
     *
     * @returns {number}
     */
    get x() {
        return this._x;
    }

    /**
     * X coordinate setter. Updates visual style.
     *
     * @param {number} value
     */
    set x(value) {
        const me = this;
        me._x = value;
        me._updateGeometryStyles();
    }

    /**
     * Y coordinate getter.
     *
     * @returns {number}
     */
    get y() {
        return this._y;
    }

    /**
     * Y coordinate setter. Updates visual style.
     *
     * @param {number} value
     */
    set y(value) {
        const me = this;
        me._y = value;
        me._updateGeometryStyles();
    }

    /**
     * Width getter.
     *
     * @returns {number}
     */
    get width() {
        return this._width;
    }

    /**
     * Width setter. Updates visual style.
     *
     * @param {number} value
     */
    set width(value) {
        const me = this;
        me._width = value;
        me._updateGeometryStyles();
    }

    /**
     * Height getter.
     *
     * @returns {number}
     */
    get height() {
        return this._height;
    }

    /**
     * Height setter. Updates visual style.
     *
     * @param {number} value
     */
    set height(value) {
        const me = this;
        me._height = value;
        me._updateGeometryStyles();
    }

    /**
     * Focused state getter.
     *
     * @returns {boolean}
     */
    get isFocused() {
        return this._isFocused;
    }

    /**
     * Focused state setter. Updates visual class.
     *
     * @param {boolean} value
     */
    set isFocused(value) {
        const me = this;
        me._isFocused = !!value;
        me._updateState();
    }

    /**
     * Maximized state getter.
     *
     * @returns {boolean}
     */
    get isMaximized() {
        return this._isMaximized;
    }

    /**
     * Minimized state getter.
     *
     * @returns {boolean}
     */
    get isMinimized() {
        return this._isMinimized;
    }

    /**
     * Pinned state getter.
     *
     * @returns {boolean}
     */
    get isPinned() {
        return this._isPinned;
    }

    /**
     * Tabbed state getter.
     *
     * @returns {boolean}
     */
    get isTabbed() {
        return this._isTabbed;
    }

    /**
     * Collapsed property for compatibility.
     * Proxies to minimized state.
     *
     * @returns {boolean}
     */
    get collapsed() {
        return this._isMinimized;
    }

    /**
     * Collapsed setter. Matches minimized state.
     *
     * @param {boolean} value
     */
    set collapsed(value) {
        const isMinimizing = !!value;
        if (this._isMinimized !== isMinimizing) {
            this.minimize();
        }
    }

    /**
     * Overrides UIElement.focus to ensure the window is brought to front.
     * Emits the WINDOW_FOCUS event for the Viewport to handle.
     *
     * @returns {void}
     */
    focus() {
        super.focus(); // Set DOM focus
        appBus.emit(EventTypes.WINDOW_FOCUS, this); // Request logical focus (Z-Index)
    }

    /**
     * Implementation of render logic.
     * Uses the adapter to create the window structure.
     *
     * @returns {HTMLElement} The root window element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createWindowElement(me.id);

        // Bind click for focus
        element.addEventListener('pointerdown', () => {
            me.focus();
        });

        return element;
    }

    /**
     * Implementation of mount logic.
     * Inserts the window into the container and initializes components.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me.element) {
            me.renderer.mount(container, me.element);

            // Mount header into the window structure
            if (me.header && me.header.element) {
                me.renderer.mountHeader(me.element, me.header.element);
            }

            me._initResizeHandles();
            me._updateGeometryStyles();
            me._updateState();
            me.constrainToParent();

            // Trigger custom mount event for legacy compatibility
            appBus.emit(EventTypes.WINDOW_MOUNT, me);
        }
    }

    /**
     * Implementation of unmount logic.
     * Cleans up handles and removes element.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;
        if (me._resizeHandleManager) {
            me._resizeHandleManager.destroy();
            me._resizeHandleManager = null;
        }
        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
    }

    /**
     * Sets the window content.
     *
     * @param {HTMLElement|object|string} content - The content to append.
     * @returns {void}
     */
    setContent(content) {
        const me = this;
        const contentElement = me.contentElement;
        if (!contentElement) return;

        // Use direct DOM manipulation here or delegate if renderer supported 'updateContent'
        // Since ApplicationWindow handles arbitrary content, we do basic injection.
        contentElement.innerHTML = '';

        if (typeof content === 'string') {
            contentElement.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            contentElement.appendChild(content);
        } else if (content && content.element instanceof HTMLElement) {
            contentElement.appendChild(content.element);
        } else {
            console.warn('ApplicationWindow: Unknown content type', content);
        }
    }

    /**
     * Hook to allow subclasses to render custom content.
     *
     * @param {HTMLElement} container - The content element.
     * @returns {void}
     */
    renderContent(container) {
        // Subclasses can override
    }

    /**
     * Registers a handler to prevent closing the window (Dirty State).
     *
     * @param {Function} callback - Returns boolean or Promise<boolean>.
     * @returns {void}
     */
    preventClose(callback) {
        if (typeof callback === 'function') {
            this._canCloseHandler = callback;
        }
    }

    /**
     * Attempts to close the window, checking preventClose handler.
     *
     * @returns {Promise<void>}
     */
    async close() {
        const me = this;
        if (me._canCloseHandler) {
            try {
                const canClose = await me._canCloseHandler();
                if (!canClose) return;
            } catch (e) {
                console.error('ApplicationWindow: Close handler error', e);
                return;
            }
        }
        me.destroy();
    }

    /**
     * Constrains the window to fit within its parent container (Viewport).
     *
     * @returns {void}
     */
    constrainToParent() {
        const me = this;
        if (me._isTabbed) return;
        if (!me.element) return;

        const parent = me.element.offsetParent;
        if (!parent) return;

        const parentWidth = parent.clientWidth;
        const parentHeight = parent.clientHeight;

        const w = me._width;
        const h = me._height;

        if (w > parentWidth) me._width = Math.max(me.minWidth, parentWidth);
        if (h > parentHeight) me._height = Math.max(me.minHeight, parentHeight);

        if (me._x < 0) me._x = 0;
        if (me._y < 0) me._y = 0;

        if (me._x + me._width > parentWidth) {
            me._x = Math.max(0, parentWidth - me._width);
        }
        if (me._y + me._height > parentHeight) {
            me._y = Math.max(0, parentHeight - me._height);
        }

        me._updateGeometryStyles();
    }

    /**
     * Toggles the maximized state.
     *
     * @returns {void}
     */
    toggleMaximize() {
        const me = this;
        if (me._isMaximized) {
            // Restore
            me._isMaximized = false;
            if (me._preMaximizeState) {
                me._x = me._preMaximizeState.x;
                me._y = me._preMaximizeState.y;
                me._width = me._preMaximizeState.width;
                me._height = me._preMaximizeState.height;
            }
        } else {
            if (me._isMinimized) {
                me._isMinimized = false;
            }
            // Maximize
            me._isMaximized = true;
            me._preMaximizeState = {
                x: me._x,
                y: me._y,
                width: me._width,
                height: me._height
            };
            // Coordinates are implicitly 0,0,100%,100% via CSS class,
            // but properties remain what they were before or updated conceptually?
            // For now, logic relies on CSS class.
        }
        me._updateState();
        if (!me._isMaximized) {
            me._updateGeometryStyles(); // Restore dimensions
        }
    }

    /**
     * Minimizes the window.
     *
     * @returns {void}
     */
    minimize() {
        const me = this;
        if (me._isMaximized) {
            me.toggleMaximize();
        }

        me._isMinimized = !me._isMinimized;
        me._updateState();

        if (!me._isMinimized) {
            me.constrainToParent();
        }
    }

    /**
     * Toggles the pinned (Always on Top) state.
     *
     * @returns {void}
     */
    togglePin() {
        const me = this;
        me._isPinned = !me._isPinned;
        me._updateState();
    }

    /**
     * Sets the window to Tabbed mode (docked) or Floating mode.
     *
     * @param {boolean} isTabbed
     * @returns {void}
     */
    setTabbed(isTabbed) {
        const me = this;
        if (me._isTabbed === isTabbed) return;

        me._isTabbed = isTabbed;
        me.header.setTabMode(isTabbed);

        if (me.element) {
            me.renderer.setTabbedMode(me.element, isTabbed);
        }

        if (isTabbed) {
            if (me._isMaximized) me.toggleMaximize();
            if (me._isMinimized) me.minimize();
        } else {
            me._updateGeometryStyles();
            me.constrainToParent();
        }
        me._updateState();
    }

    /**
     * Destroys the window and cleans up listeners/DOM.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me.header && typeof me.header.destroy === 'function') {
            me.header.destroy();
        }
        super.dispose();
    }

    /**
     * Compatibility alias for destroy.
     *
     * @returns {void}
     */
    destroy() {
        this.dispose();
    }

    /**
     * Serializes state to JSON.
     *
     * @returns {object}
     */
    toJSON() {
        const me = this;
        return {
            type: ItemType.APPLICATION_WINDOW,
            title: me._title,
            geometry: {
                x: me._x,
                y: me._y,
                width: me._width,
                height: me._height
            },
            state: {
                maximized: me._isMaximized,
                minimized: me._isMinimized,
                pinned: me._isPinned,
                tabbed: me._isTabbed
            }
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
        if (data.title) me.title = data.title;
        if (data.geometry) {
            me._x = data.geometry.x;
            me._y = data.geometry.y;
            me._width = data.geometry.width;
            me._height = data.geometry.height;
            me._updateGeometryStyles();
        }
        if (data.state) {
            if (data.state.pinned) me.togglePin();
            if (data.state.minimized) me.minimize();
            if (data.state.maximized) me.toggleMaximize();
            if (data.state.tabbed) me.setTabbed(true);
        }
    }

    /**
     * Initializes the ResizeHandleManager.
     *
     * @private
     * @returns {void}
     */
    _initResizeHandles() {
        const me = this;
        if (!me.element) return;

        me._resizeHandleManager = new ResizeHandleManager(me.element, {
            handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
            customClass: 'window-resize-handle',
            getConstraints: () => {
                const parent = me.element.offsetParent || document.body;
                return {
                    minimumWidth: me.minWidth,
                    maximumWidth: Infinity,
                    minimumHeight: me.minHeight,
                    maximumHeight: Infinity,
                    containerRectangle: parent.getBoundingClientRect()
                };
            },
            onResize: ({ xCoordinate, yCoordinate, width, height }) => {
                if (me._isMaximized) return;

                me._x = xCoordinate;
                me._y = yCoordinate;
                me._width = width;
                me._height = height;
                me._updateGeometryStyles();
            }
        });
    }

    /**
     * Updates the DOM geometry styles via renderer.
     *
     * @private
     * @returns {void}
     */
    _updateGeometryStyles() {
        const me = this;
        if (me.element && !me._isTabbed) {
            me.renderer.updateGeometry(me.element, me._x, me._y, me._width, me._height);
        }
    }

    /**
     * Updates the visual state classes via renderer.
     *
     * @private
     * @returns {void}
     */
    _updateState() {
        const me = this;
        if (me.element) {
            me.renderer.updateStateClasses(me.element, {
                maximized: me._isMaximized,
                minimized: me._isMinimized,
                focused: me._isFocused,
                pinned: me._isPinned,
                tabbed: me._isTabbed
            });
        }
    }
}
