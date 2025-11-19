import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { DropZoneType } from '../../constants/DNDTypes.js';
import { ViewportFactory } from './ViewportFactory.js';

/**
 * Description:
 * A container component that acts as a manager for ApplicationWindow instances.
 * It provides a bounded area (relative positioning context) where windows can float,
 * overlap, and be organized.
 *
 * It manages the stacking order (Z-Index) of windows, ensuring that "Always on Top"
 * windows remain above standard windows, and that the currently focused window
 * is brought to the front of its respective layer.
 *
 * Properties summary:
 * - id {string} : Unique identifier for the viewport.
 * - element {HTMLElement} : The main DOM element (.viewport).
 * - dropZoneType {string} : The identifier for the DragDropService.
 * - _windows {Array<ApplicationWindow>} : List of managed windows.
 * - _activeWindow {ApplicationWindow|null} : The currently focused window.
 * - _namespace {string} : Namespace for event listeners.
 * - _baseZIndex {number} : Starting z-index for standard windows.
 * - _alwaysOnTopZIndex {number} : Starting z-index for pinned windows.
 * - _boundOnWindowFocus {Function} : Bound handler for focus events.
 * - _boundOnWindowClose {Function} : Bound handler for close events.
 * - _boundOnArrangeCascade {Function} : Bound handler for cascade commands.
 * - _boundOnArrangeTile {Function} : Bound handler for tile commands.
 *
 * Typical usage:
 * const viewport = new Viewport();
 * document.body.appendChild(viewport.element);
 * viewport.addWindow(new ApplicationWindow(...));
 *
 * Events:
 * - Listens to (appBus): EventTypes.WINDOW_FOCUS
 * - Listens to (appBus): EventTypes.WINDOW_CLOSE_REQUEST
 * - Listens to (appBus): EventTypes.VIEWPORT_ARRANGE_CASCADE
 * - Listens to (appBus): EventTypes.VIEWPORT_ARRANGE_TILE
 *
 * Business rules implemented:
 * - Acts as a 'viewport' drop zone type.
 * - Maintains two distinct Z-Index layers: Standard and Pinned.
 * - Automatically brings focused windows to the top of their layer.
 * - Provides algorithmic layout strategies (Cascade, Tile) for open windows.
 * - removing a window automatically focuses the next available window.
 * - Supports serialization via toJSON/fromJSON using ViewportFactory.
 * - Manages window lifecycle (mount) when adding windows.
 *
 * Dependencies:
 * - ../../utils/EventBus.js
 * - ../../utils/generateId.js
 * - ../../constants/EventTypes.js
 * - ../../constants/DNDTypes.js
 * - ./ApplicationWindow.js
 * - ./ViewportFactory.js
 */
export class Viewport {
    /**
     * Unique identifier for the viewport.
     *
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * The main DOM element.
     *
     * @type {HTMLElement}
     * @public
     */
    element;

    /**
     * The drop zone type identifier.
     *
     * @type {string}
     * @public
     */
    dropZoneType;

    /**
     * List of managed windows.
     *
     * @type {Array<import('./ApplicationWindow.js').ApplicationWindow>}
     * @private
     */
    _windows = [];

    /**
     * The currently focused window.
     *
     * @type {import('./ApplicationWindow.js').ApplicationWindow | null}
     * @private
     */
    _activeWindow = null;

    /**
     * Namespace for event listeners.
     *
     * @type {string}
     * @private
     */
    _namespace;

    /**
     * Starting z-index for standard windows.
     *
     * @type {number}
     * @private
     */
    _baseZIndex = 10;

    /**
     * Starting z-index for pinned windows.
     *
     * @type {number}
     * @private
     */
    _alwaysOnTopZIndex = 1000;

    /**
     * Bound handler for focus events.
     *
     * @type {Function}
     * @private
     */
    _boundOnWindowFocus;

    /**
     * Bound handler for close events.
     *
     * @type {Function}
     * @private
     */
    _boundOnWindowClose;

    /**
     * Bound handler for cascade commands.
     *
     * @type {Function}
     * @private
     */
    _boundOnArrangeCascade;

    /**
     * Bound handler for tile commands.
     *
     * @type {Function}
     * @private
     */
    _boundOnArrangeTile;

    /**
     * Creates an instance of Viewport.
     */
    constructor() {
        const me = this;
        me._namespace = `viewport-${me.id}`;

        me.element = document.createElement('div');
        me.element.classList.add('viewport');

        // Critical for DND Strategy detection
        me.dropZoneType = DropZoneType.VIEWPORT;
        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        // Ensure relative positioning so absolute windows are anchored here
        me.element.style.position = 'relative';
        me.element.style.width = '100%';
        me.element.style.height = '100%';
        me.element.style.overflow = 'hidden';

        me._boundOnWindowFocus = me._onWindowFocus.bind(me);
        me._boundOnWindowClose = me._onWindowClose.bind(me);
        me._boundOnArrangeCascade = me.cascade.bind(me);
        me._boundOnArrangeTile = me.tile.bind(me);

        me._initEventListeners();
    }

    /**
     * Gets the list of managed windows.
     *
     * @returns {Array<import('./ApplicationWindow.js').ApplicationWindow>}
     */
    get windows() {
        return this._windows;
    }

    /**
     * Initializes event listeners on the appBus.
     *
     * @private
     * @returns {void}
     */
    _initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };

        appBus.on(EventTypes.WINDOW_FOCUS, me._boundOnWindowFocus, options);
        appBus.on(EventTypes.WINDOW_CLOSE_REQUEST, me._boundOnWindowClose, options);
        appBus.on(EventTypes.VIEWPORT_ARRANGE_CASCADE, me._boundOnArrangeCascade, options);
        appBus.on(EventTypes.VIEWPORT_ARRANGE_TILE, me._boundOnArrangeTile, options);
    }

    /**
     * Adds a window to the viewport and mounts it.
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance - The window to add.
     * @returns {void}
     */
    addWindow(windowInstance) {
        const me = this;
        if (!windowInstance) {
            console.warn('Viewport: Attempted to add invalid window.');
            return;
        }

        if (!me._windows.includes(windowInstance)) {
            me._windows.push(windowInstance);
            me.element.appendChild(windowInstance.element);

            // Trigger mount lifecycle to render content
            if (typeof windowInstance.mount === 'function') {
                windowInstance.mount();
            }
        }

        me.focusWindow(windowInstance);
    }

    /**
     * Removes a window from the viewport.
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance - The window to remove.
     * @returns {void}
     */
    removeWindow(windowInstance) {
        const me = this;
        const index = me._windows.indexOf(windowInstance);

        if (index === -1) {
            return;
        }

        me._windows.splice(index, 1);

        if (me.element.contains(windowInstance.element)) {
            me.element.removeChild(windowInstance.element);
        }

        // Destroy calls unmount internally
        if (typeof windowInstance.destroy === 'function') {
            windowInstance.destroy();
        }

        // Focus the next available window if the active one was removed
        if (me._activeWindow === windowInstance) {
            me._activeWindow = null;
            const nextWindow = me._windows[me._windows.length - 1];
            if (nextWindow) {
                me.focusWindow(nextWindow);
            }
        }
    }

    /**
     * Focuses a specific window, bringing it to the front of its layer.
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance - The window to focus.
     * @returns {void}
     */
    focusWindow(windowInstance) {
        const me = this;
        if (!me._windows.includes(windowInstance)) {
            return;
        }

        if (me._activeWindow && me._activeWindow !== windowInstance) {
            me._activeWindow.isFocused = false;
        }

        me._activeWindow = windowInstance;
        windowInstance.isFocused = true;

        // Reorder array to reflect "recency" (move to end)
        // This simplifies Z-index calculation: index in array = relative height
        const index = me._windows.indexOf(windowInstance);
        if (index > -1) {
            me._windows.splice(index, 1);
            me._windows.push(windowInstance);
        }

        me._updateZIndices();
    }

    /**
     * Recalculates and applies z-indices for all windows.
     * Enforces separation between standard and "Always on Top" layers.
     *
     * @private
     * @returns {void}
     */
    _updateZIndices() {
        const me = this;

        // Separate windows into layers based on their internal state
        const standardWindows = [];
        const pinnedWindows = [];

        me._windows.forEach(win => {
            if (win.isPinned) {
                pinnedWindows.push(win);
            } else {
                standardWindows.push(win);
            }
        });

        // Apply Z-indices based on position in the arrays (which reflects recency)
        standardWindows.forEach((win, index) => {
            win.element.style.zIndex = me._baseZIndex + index;
        });

        pinnedWindows.forEach((win, index) => {
            win.element.style.zIndex = me._alwaysOnTopZIndex + index;
        });
    }

    /**
     * Arranges all windows in a cascading pattern.
     *
     * @returns {void}
     */
    cascade() {
        const me = this;
        const offset = 30;
        const startX = 20;
        const startY = 20;

        me._windows.forEach((win, index) => {
            if (win.isMaximized) {
                win.toggleMaximize();
            }

            const x = startX + index * offset;
            const y = startY + index * offset;

            win.element.style.left = `${x}px`;
            win.element.style.top = `${y}px`;

            if ('x' in win) win.x = x;
            if ('y' in win) win.y = y;
        });
    }

    /**
     * Arranges all windows in a tile pattern.
     *
     * @returns {void}
     */
    tile() {
        const me = this;
        const count = me._windows.length;
        if (count === 0) return;

        const viewportRect = me.element.getBoundingClientRect();
        const areaWidth = viewportRect.width;
        const areaHeight = viewportRect.height;

        // Calculate grid dimensions
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);

        const cellWidth = areaWidth / cols;
        const cellHeight = areaHeight / rows;

        me._windows.forEach((win, index) => {
            if (win.isMaximized) {
                win.toggleMaximize();
            }

            const colIndex = index % cols;
            const rowIndex = Math.floor(index / cols);

            const x = colIndex * cellWidth;
            const y = rowIndex * cellHeight;
            const w = cellWidth;
            const h = cellHeight;

            win.element.style.left = `${x}px`;
            win.element.style.top = `${y}px`;
            win.element.style.width = `${w}px`;
            win.element.style.height = `${h}px`;

            if ('x' in win) win.x = x;
            if ('y' in win) win.y = y;
            if ('width' in win) win.width = w;
            if ('height' in win) win.height = h;
        });
    }

    /**
     * Event handler for window focus requests.
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance
     * @private
     * @returns {void}
     */
    _onWindowFocus(windowInstance) {
        const me = this;
        if (me._windows.includes(windowInstance)) {
            me.focusWindow(windowInstance);
        }
    }

    /**
     * Event handler for window close requests.
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance
     * @private
     * @returns {void}
     */
    _onWindowClose(windowInstance) {
        const me = this;
        if (me._windows.includes(windowInstance)) {
            windowInstance.close().then(() => {
                // Check if element is removed from DOM (successful close)
                if (!document.body.contains(windowInstance.element)) {
                    me.removeWindow(windowInstance);
                }
            });
        }
    }

    /**
     * Cleans up listeners and removes the viewport.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        [...me._windows].forEach(win => win.destroy());
        me._windows = [];

        me.element.remove();
    }

    /**
     * Serializes the viewport and its windows to JSON.
     *
     * @returns {object}
     */
    toJSON() {
        const me = this;
        return {
            type: DropZoneType.VIEWPORT,
            windows: me._windows.map(win => win.toJSON())
        };
    }

    /**
     * Deserializes state from JSON data.
     *
     * @param {object} data
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        // Clear existing windows before loading
        [...me._windows].forEach(win => me.removeWindow(win));

        if (data.windows && Array.isArray(data.windows)) {
            const factory = ViewportFactory.getInstance();
            data.windows.forEach(winData => {
                const win = factory.createWindow(winData);
                if (win) {
                    me.addWindow(win);
                }
            });
        }
    }
}
