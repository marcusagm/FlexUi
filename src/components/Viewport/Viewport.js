import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { DropZoneType } from '../../constants/DNDTypes.js';
import { ViewportFactory } from './ViewportFactory.js';

/**
 * Description:
 * A container component that acts as a manager for ApplicationWindow instances.
 * It provides a bounded area (relative positioning context) where windows can float,
 * overlap, or be docked into tabs.
 *
 * It manages the stacking order (Z-Index) of windows, ensuring that "Always on Top"
 * windows remain above standard windows, and that the currently focused window
 * is brought to the front of its respective layer.
 *
 * Properties summary:
 * - id {string} : Unique identifier for the viewport.
 * - element {HTMLElement} : The main DOM element (.viewport).
 * - dropZoneType {string} : The identifier for the DragDropService.
 * - _tabBar {HTMLElement} : Container for window headers when they are docked as tabs.
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
 * viewport.dockWindow(newWindow); // Convert to tab
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
 * - Removes a window automatically focuses the next available window.
 * - Supports serialization via toJSON/fromJSON using ViewportFactory.
 * - Manages window lifecycle (mount) when adding windows.
 * - Allows docking windows into a tab bar, changing their state and visual representation.
 * - Dynamically hides the tab bar if no windows are docked.
 * - Ensures a background tab is always visible if tabs exist, even when focusing floating windows.
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
     * Container for window headers when they are docked as tabs.
     *
     * @type {HTMLElement}
     * @private
     */
    _tabBar;

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

        me.dropZoneType = DropZoneType.VIEWPORT;
        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        // Create Tab Bar
        me._tabBar = document.createElement('div');
        me._tabBar.classList.add('viewport__tab-bar');
        me._tabBar.dataset.dropzone = DropZoneType.VIEWPORT_TAB_BAR;

        // Proxy for Tab Bar Drop Zone
        me._tabBar.dropZoneInstance = {
            dropZoneType: DropZoneType.VIEWPORT_TAB_BAR,
            dockWindow: me.dockWindow.bind(me),
            get tabBar() {
                return me._tabBar;
            }
        };

        me.element.appendChild(me._tabBar);

        me._boundOnWindowFocus = me._onWindowFocus.bind(me);
        me._boundOnWindowClose = me._onWindowClose.bind(me);
        me._boundOnArrangeCascade = me.cascade.bind(me);
        me._boundOnArrangeTile = me.tile.bind(me);

        me._initEventListeners();
        me._updateTabBarVisibility();
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
     * The DOM element representing the tab bar.
     * Exposed for DND strategies to detect drop targets.
     *
     * @returns {HTMLElement}
     */
    get tabBar() {
        return this._tabBar;
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
     * Updates the visibility of the tab bar based on the presence of docked windows.
     *
     * @private
     * @returns {void}
     */
    _updateTabBarVisibility() {
        const hasTabs = this._windows.some(w => w.isTabbed);
        if (hasTabs) {
            this._tabBar.classList.remove('viewport__tab-bar--hidden');
        } else {
            this._tabBar.classList.add('viewport__tab-bar--hidden');
        }
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

        if (typeof windowInstance.destroy === 'function') {
            windowInstance.destroy();
        } else {
            windowInstance.element.remove();
            if (windowInstance.header && windowInstance.header.element) {
                windowInstance.header.element.remove();
            }
        }

        me._updateTabBarVisibility();

        // Focus the next available window if the active one was removed
        if (me._activeWindow === windowInstance) {
            me._activeWindow = null;
            const remaining = me._windows;
            if (remaining.length > 0) {
                me.focusWindow(remaining[remaining.length - 1]);
            }
        }
    }

    /**
     * Focuses a specific window.
     * If floating: Brings to front (Z-Index).
     * If tabbed: Shows content, hides other tabs' content, highlights tab.
     * Also ensures that if we focus a floating window, we still keep a background tab active (if any exists).
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
        const index = me._windows.indexOf(windowInstance);
        if (index > -1) {
            me._windows.splice(index, 1);
            me._windows.push(windowInstance);
        }

        if (windowInstance.isTabbed) {
            // Exclusive Tab Mode Visibility
            me._windows.forEach(win => {
                if (win.isTabbed) {
                    const isActive = win === windowInstance;
                    win.element.classList.toggle('application-window--active-tab', isActive);
                    if (win.header)
                        win.header.element.classList.toggle('window-header--active', isActive);
                }
            });
        } else {
            // Floating Mode
            me._updateZIndices();

            // Fallback: Ensure background tab layer is not empty if tabs exist
            const hasActiveTab = me._windows.some(
                w => w.isTabbed && w.element.classList.contains('application-window--active-tab')
            );

            if (!hasActiveTab) {
                // Find the last tabbed window to activate as background
                for (let i = me._windows.length - 1; i >= 0; i--) {
                    const win = me._windows[i];
                    if (win.isTabbed) {
                        win.element.classList.add('application-window--active-tab');
                        if (win.header) win.header.element.classList.add('window-header--active');
                        break;
                    }
                }
            }
        }
    }

    /**
     * Docks a window into the tab bar.
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance - The window to dock.
     * @param {number|null} [index=null] - Optional index to insert tab at.
     * @returns {void}
     */
    dockWindow(windowInstance, index = null) {
        const me = this;
        if (!me._windows.includes(windowInstance)) return;

        const headerEl = windowInstance.header.element;

        const getReferenceNode = idx => {
            const headers = Array.from(me._tabBar.children).filter(c =>
                c.classList.contains('window-header')
            );
            if (idx >= headers.length) return null;
            return headers[idx];
        };

        if (windowInstance.isTabbed) {
            if (index !== null) {
                const reference = getReferenceNode(index);
                if (reference === headerEl) return;

                if (reference) {
                    me._tabBar.insertBefore(headerEl, reference);
                } else {
                    me._tabBar.appendChild(headerEl);
                }
            }
            return;
        }

        windowInstance.setTabbed(true);

        if (index !== null) {
            const reference = getReferenceNode(index);
            if (reference) {
                me._tabBar.insertBefore(headerEl, reference);
            } else {
                me._tabBar.appendChild(headerEl);
            }
        } else {
            me._tabBar.appendChild(headerEl);
        }

        me._updateTabBarVisibility();
        me.focusWindow(windowInstance);
    }

    /**
     * Undocks a window (makes it floating).
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance - The window to undock.
     * @param {number} [x=50] - The new X coordinate.
     * @param {number} [y=50] - The new Y coordinate.
     * @returns {void}
     */
    undockWindow(windowInstance, x = 50, y = 50) {
        const me = this;
        if (!me._windows.includes(windowInstance)) return;
        if (!windowInstance.isTabbed) return;

        windowInstance.setTabbed(false);

        // Cleanup active classes manually to ensure state is clean before focusWindow logic
        windowInstance.element.classList.remove('application-window--active-tab');
        if (windowInstance.header)
            windowInstance.header.element.classList.remove('window-header--active');

        const headerEl = windowInstance.header.element;
        if (windowInstance.element.firstChild) {
            windowInstance.element.insertBefore(headerEl, windowInstance.element.firstChild);
        } else {
            windowInstance.element.appendChild(headerEl);
        }

        windowInstance.x = x;
        windowInstance.y = y;

        windowInstance.constrainToParent();
        me._updateTabBarVisibility();

        me.focusWindow(windowInstance);
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

        const standardWindows = [];
        const pinnedWindows = [];

        me._windows.forEach(win => {
            if (win.isTabbed) return;

            if (win.isPinned) {
                pinnedWindows.push(win);
            } else {
                standardWindows.push(win);
            }
        });

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
        let count = 0;

        me._windows.forEach(win => {
            if (win.isTabbed) return;
            if (win.isMaximized) win.toggleMaximize();

            const x = 20 + count * offset;
            const y = 20 + count * offset;

            win.x = x;
            win.y = y;

            count++;
        });
    }

    /**
     * Arranges all windows in a tile pattern.
     *
     * @returns {void}
     */
    tile() {
        const me = this;
        const floatingWindows = me._windows.filter(w => !w.isTabbed);
        const count = floatingWindows.length;
        if (count === 0) return;

        const viewportRect = me.element.getBoundingClientRect();
        const tabBarHeight = me._tabBar.offsetHeight;
        const areaWidth = viewportRect.width;
        const areaHeight = viewportRect.height - tabBarHeight;

        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);

        const cellWidth = areaWidth / cols;
        const cellHeight = areaHeight / rows;

        floatingWindows.forEach((win, index) => {
            if (win.isMaximized) {
                win.toggleMaximize();
            }

            const colIndex = index % cols;
            const rowIndex = Math.floor(index / cols);

            const x = colIndex * cellWidth;
            const y = rowIndex * cellHeight + tabBarHeight;
            const w = cellWidth;
            const h = cellHeight;

            win.x = x;
            win.y = y;
            win.width = w;
            win.height = h;
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
                    if (win.isTabbed) {
                        me.dockWindow(win);
                    }
                }
            });
        }
    }
}
