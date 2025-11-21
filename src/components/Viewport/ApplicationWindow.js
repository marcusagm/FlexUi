import { ApplicationWindowHeader } from './ApplicationWindowHeader.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { ItemType } from '../../constants/DNDTypes.js';
import { FloatingPanelManagerService } from '../../services/DND/FloatingPanelManagerService.js';

/**
 * Description:
 * A standalone component representing a floating window within the application Viewport.
 * It manages its own DOM structure, lifecycle, geometry, and state (maximized, minimized, pinned).
 *
 * Unlike PanelGroup, this class is a dedicated window frame that can host arbitrary content.
 * It integrates with the system's EventBus and DND services, and uses ResizeHandleManager for
 * 8-directional resizing.
 *
 * Properties summary:
 * - id {string} : Unique identifier for the window.
 * - element {HTMLElement} : The main DOM element (.application-window).
 * - header {ApplicationWindowHeader} : The window header component.
 * - contentElement {HTMLElement} : The container for window content.
 * - title {string} : The window title.
 * - x {number} : X coordinate relative to parent.
 * - y {number} : Y coordinate relative to parent.
 * - width {number} : Window width in pixels.
 * - height {number} : Window height in pixels.
 * - minWidth {number} : Minimum width constraint.
 * - minHeight {number} : Minimum height constraint.
 * - _isFocused {boolean} : Focused state flag.
 * - _isMaximized {boolean} : Maximized state flag.
 * - _isMinimized {boolean} : Minimized state flag.
 * - _isPinned {boolean} : Pinned (always on top) state flag.
 * - _isTabbed {boolean} : Tabbed (docked) state flag.
 * - _preMaximizeState {object|null} : Geometry snapshot before maximization.
 * - _resizeHandleManager {ResizeHandleManager} : Handles 8-way resizing.
 * - _canCloseHandler {Function|null} : Callback to validate closing.
 *
 * Typical usage:
 * const win = new ApplicationWindow('My Window', contentNode, { x: 100, y: 100 });
 * document.body.appendChild(win.element);
 * win.mount();
 *
 * Events:
 * - Emits (appBus): EventTypes.WINDOW_FOCUS, EventTypes.WINDOW_CLOSE_REQUEST, EventTypes.WINDOW_MOUNT
 *
 * Business rules implemented:
 * - Independent lifecycle management (mount/destroy).
 * - 8-direction resizing with boundary constraints relative to the parent Viewport.
 * - Geometry state persistence (maximize/restore).
 * - Intercepts close requests via `preventClose` (async support).
 * - Identifies as `ItemType.APPLICATION_WINDOW` for DND.
 * - Automatically constrains itself to parent bounds on mount and un-minimize.
 * - Prevents minimization when maximized.
 * - Supports "Tabbed" mode where it acts as a content panel filling available space, disabling resize and absolute positioning.
 *
 * Dependencies:
 * - ./ApplicationWindowHeader.js
 * - ../../utils/ResizeHandleManager.js
 * - ../../utils/EventBus.js
 * - ../../utils/generateId.js
 * - ../../constants/EventTypes.js
 * - ../../constants/DNDTypes.js
 *
 * Notes / Additional:
 * - This class does not extend Panel or PanelGroup.
 */
export class ApplicationWindow {
    /**
     * Unique identifier for the window.
     *
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * The main DOM element (.application-window).
     *
     * @type {HTMLElement}
     * @public
     */
    element;

    /**
     * The window header component.
     *
     * @type {ApplicationWindowHeader}
     * @public
     */
    header;

    /**
     * The container for window content.
     *
     * @type {HTMLElement}
     * @public
     */
    contentElement;

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
     * @param {HTMLElement|object|string|null} [content=null] - The initial content (Node, string, or object with .element).
     * @param {object} [config={}] - Configuration options (x, y, width, height).
     */
    constructor(title = 'Window', content = null, config = {}) {
        const me = this;
        me._title = title;

        if (config.x !== undefined) me._x = config.x;
        if (config.y !== undefined) me._y = config.y;
        if (config.width !== undefined) me._width = config.width;
        if (config.height !== undefined) me._height = config.height;
        if (config.minWidth !== undefined) me.minWidth = config.minWidth;
        if (config.minHeight !== undefined) me.minHeight = config.minHeight;

        me._buildDOM();
        me._initResizeHandles();

        if (content) {
            me.setContent(content);
        }

        me._updateGeometryStyles();
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
        this._title = value;
        if (this.header) {
            this.header.setTitle(value);
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
        this._x = value;
        this._updateGeometryStyles();
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
        this._y = value;
        this._updateGeometryStyles();
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
        this._width = value;
        this._updateGeometryStyles();
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
        this._height = value;
        this._updateGeometryStyles();
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
        this._isFocused = !!value;
        this.element.classList.toggle('application-window--focused', this._isFocused);
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
     * Builds the DOM structure (Frame, Header, Content).
     *
     * @private
     * @returns {void}
     */
    _buildDOM() {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('application-window');
        // Ensure absolute positioning for floating behavior
        me.element.style.position = 'absolute';

        // Click on window brings to focus
        me.element.addEventListener('pointerdown', () => {
            appBus.emit(EventTypes.WINDOW_FOCUS, me);
        });

        me.header = new ApplicationWindowHeader(me, me._title);
        me.element.appendChild(me.header.element);

        me.contentElement = document.createElement('div');
        me.contentElement.classList.add('application-window__content');
        // Default styles for content area
        me.contentElement.style.overflow = 'auto';
        me.contentElement.style.flex = '1';
        me.contentElement.style.position = 'relative';

        me.element.appendChild(me.contentElement);
    }

    /**
     * Initializes the ResizeHandleManager for 8-direction resizing.
     *
     * @private
     * @returns {void}
     */
    _initResizeHandles() {
        const me = this;

        me._resizeHandleManager = new ResizeHandleManager(me.element, {
            handles: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
            customClass: 'window-resize-handle', // Theme hook
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
                if (me._isMaximized) return; // Block resize if maximized

                me._x = xCoordinate;
                me._y = yCoordinate;
                me._width = width;
                me._height = height;
                me._updateGeometryStyles();
            }
        });
    }

    /**
     * Updates the DOM styles to reflect current geometry properties.
     *
     * @private
     * @returns {void}
     */
    _updateGeometryStyles() {
        const me = this;
        if (me.element) {
            // Only apply geometry styles if NOT tabbed
            if (!me._isTabbed) {
                me.element.style.left = `${me._x}px`;
                me.element.style.top = `${me._y}px`;
                me.element.style.width = `${me._width}px`;
                me.element.style.height = `${me._height}px`;
            }
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
        me.contentElement.innerHTML = '';

        if (typeof content === 'string') {
            me.contentElement.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            me.contentElement.appendChild(content);
        } else if (content && (typeof content.element) instanceof HTMLElement) {
            me.contentElement.appendChild(content.element);
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
        container;
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
     * Ensures valid placement on mount or un-minimize.
     *
     * @returns {void}
     */
    constrainToParent() {
        // Do not constrain if tabbed
        if (this._isTabbed) return;

        const parent = this.element.offsetParent;
        if (!parent) return;

        const parentWidth = parent.clientWidth;
        const parentHeight = parent.clientHeight;

        const w = this._width;
        const h = this._height;

        if (w > parentWidth) this._width = Math.max(this.minWidth, parentWidth);
        if (h > parentHeight) this._height = Math.max(this.minHeight, parentHeight);

        if (this._x < 0) this._x = 0;
        if (this._y < 0) this._y = 0;

        if (this._x + this._width > parentWidth) {
            this._x = Math.max(0, parentWidth - this._width);
        }
        if (this._y + this._height > parentHeight) {
            this._y = Math.max(0, parentHeight - this._height);
        }

        this._updateGeometryStyles();
    }

    /**
     * Lifecycle hook: Mounts the window.
     *
     * @returns {void}
     */
    mount() {
        appBus.emit(EventTypes.WINDOW_MOUNT, this);
        this.renderContent(this.contentElement);
        this.constrainToParent();
    }

    /**
     * Lifecycle hook: Unmounts the window.
     *
     * @returns {void}
     */
    unmount() {
        // Cleanup hook
    }

    /**
     * Destroys the window and cleans up listeners/DOM.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        me.unmount();
        if (me._resizeHandleManager) {
            me._resizeHandleManager.destroy();
        }
        if (me.header) {
            me.header.destroy();
        }
        me.element.remove();
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
            me.element.classList.remove('application-window--maximized');
            if (me._preMaximizeState) {
                me._x = me._preMaximizeState.x;
                me._y = me._preMaximizeState.y;
                me._width = me._preMaximizeState.width;
                me._height = me._preMaximizeState.height;
                me._updateGeometryStyles();
            }
        } else {
            if (me._isMinimized) {
                me._isMinimized = false;
                me.element.classList.remove('application-window--minimized');
            }
            // Maximize
            me._isMaximized = true;
            me._preMaximizeState = { x: me._x, y: me._y, width: me._width, height: me._height };
            me.element.classList.add('application-window--maximized');

            me.element.style.top = '0';
            me.element.style.left = '0';
            me.element.style.width = '100%';
            me.element.style.height = '100%';
        }
    }

    /**
     * Minimizes the window.
     *
     * @returns {void}
     */
    minimize() {
        if (this._isMaximized) {
            this.toggleMaximize();
        }

        this._isMinimized = !this._isMinimized;
        this.element.classList.toggle('application-window--minimized', this._isMinimized);

        if (!this._isMinimized) {
            this.constrainToParent();
        }
    }

    /**
     * Toggles the pinned (Always on Top) state.
     *
     * @returns {void}
     */
    togglePin() {
        this._isPinned = !this._isPinned;
        this.element.classList.toggle('application-window--pinned', this._isPinned);
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

        if (isTabbed) {
            // Enter Tab Mode
            me.element.classList.add('application-window--tabbed');

            // Reset absolute positioning styles
            me.element.style.position = '';
            me.element.style.left = '';
            me.element.style.top = '';
            me.element.style.width = '';
            me.element.style.height = '';
            me.element.style.zIndex = '';

            // Ensure flags are reset
            if (me._isMaximized) me.toggleMaximize();
            if (me._isMinimized) me.minimize();
        } else {
            // Exit Tab Mode (Restore Floating)
            me.element.classList.remove('application-window--tabbed');
            me.element.style.position = 'absolute';

            // Restore geometry
            me._updateGeometryStyles();
            // Ensure it is visible
            me.constrainToParent();
        }
    }

    /**
     * Serializes state to JSON.
     *
     * @returns {object}
     */
    toJSON() {
        return {
            type: ItemType.APPLICATION_WINDOW,
            title: this._title,
            geometry: { x: this._x, y: this._y, width: this._width, height: this._height },
            state: {
                maximized: this._isMaximized,
                minimized: this._isMinimized,
                pinned: this._isPinned,
                tabbed: this._isTabbed
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
        if (data.title) this.title = data.title;
        if (data.geometry) {
            this._x = data.geometry.x;
            this._y = data.geometry.y;
            this._width = data.geometry.width;
            this._height = data.geometry.height;
            this._updateGeometryStyles();
        }
        if (data.state) {
            if (data.state.pinned) this.togglePin();
            if (data.state.minimized) this.minimize();
            if (data.state.maximized) this.toggleMaximize();
            if (data.state.tabbed) this.setTabbed(true);
        }
    }
}
