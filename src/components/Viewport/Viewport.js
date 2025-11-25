import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { DropZoneType } from '../../constants/DNDTypes.js';
import { ViewportFactory } from './ViewportFactory.js';
import { TabStrip } from '../Core/TabStrip.js';
import { UIElement } from '../../core/UIElement.js';

/**
 * Description:
 * A wrapper class to adapt the ApplicationWindowHeader to the UIElement interface
 * required by TabStrip. This acts as the "Tab Item" within the strip.
 *
 * @internal
 */
class WindowHeaderWrapper extends UIElement {
    /**
     * @param {import('./ApplicationWindowHeader.js').ApplicationWindowHeader} header - The window header component.
     */
    constructor(header) {
        super();
        this.header = header;
    }

    _doRender() {
        return this.header.element;
    }

    get element() {
        return this.header.element;
    }
}

/**
 * Description:
 * A container component that acts as a manager for ApplicationWindow instances.
 * It provides a bounded area (relative positioning context) where windows can float,
 * overlap, or be docked into tabs using a TabStrip.
 *
 * It manages the stacking order (Z-Index) of windows and coordinates with
 * the TabStrip to handle docked (tabbed) windows.
 *
 * Properties summary:
 * - id {string} : Unique identifier for the viewport.
 * - element {HTMLElement} : The main DOM element (.viewport).
 * - dropZoneType {string} : The identifier for the DragDropService.
 * - tabBar {HTMLElement} : The DOM element representing the tab strip container.
 * - windows {Array<ApplicationWindow>} : List of managed windows.
 * - _tabStrip {TabStrip} : The component managing the list of docked window tabs.
 * - _windowWrappers {Map<ApplicationWindow, WindowHeaderWrapper>} : Maps windows to their tab wrappers.
 * - _activeWindow {ApplicationWindow|null} : The currently focused window.
 *
 * Typical usage:
 * const viewport = new Viewport();
 * document.body.appendChild(viewport.element);
 * viewport.addWindow(new ApplicationWindow(...));
 * viewport.dockWindow(newWindow);
 *
 * Events:
 * - Listens to (appBus): EventTypes.WINDOW_FOCUS
 * - Listens to (appBus): EventTypes.WINDOW_CLOSE_REQUEST
 * - Listens to (appBus): EventTypes.VIEWPORT_ARRANGE_CASCADE
 * - Listens to (appBus): EventTypes.VIEWPORT_ARRANGE_TILE
 *
 * Business rules implemented:
 * - Acts as a 'viewport' drop zone type.
 * - Manages Z-Index layering (Standard vs Pinned).
 * - Integrates TabStrip for docking functionality.
 * - Automatically hides the TabStrip when no windows are docked.
 * - Synchronizes Window focus with Tab selection.
 *
 * Dependencies:
 * - TabStrip
 * - UIElement (via Wrapper)
 * - EventBus
 * - ViewportFactory
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
     * Container for the TabStrip.
     *
     * @type {HTMLElement}
     * @private
     */
    _tabBarContainer;

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
     * The TabStrip component instance.
     *
     * @type {TabStrip}
     * @private
     */
    _tabStrip;

    /**
     * Maps windows to their UIElement wrappers for the TabStrip.
     *
     * @type {Map<import('./ApplicationWindow.js').ApplicationWindow, WindowHeaderWrapper>}
     * @private
     */
    _windowWrappers = new Map();

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

        // Create Tab Bar Container (visual wrapper)
        me._tabBarContainer = document.createElement('div');
        me._tabBarContainer.classList.add('viewport__tab-bar');

        // Initialize TabStrip
        me._tabStrip = new TabStrip(me.id + '-tabs', {
            orientation: 'horizontal',
            simpleMode: false // Viewport tabs usually stay visible or follow specific logic
        });

        // Mount TabStrip into the container
        me._tabStrip.mount(me._tabBarContainer);

        // Proxy for Tab Bar Drop Zone
        // Note: We attach the dropzone data to the container, but the strategy might look at children.
        // With TabStrip, children are inside the strip's viewport.
        me._tabBarContainer.dataset.dropzone = DropZoneType.VIEWPORT_TAB_BAR;
        me._tabBarContainer.dropZoneInstance = {
            dropZoneType: DropZoneType.VIEWPORT_TAB_BAR,
            dockWindow: me.dockWindow.bind(me),
            get tabBar() {
                // Expose the Strip's root element to the strategy so it can find items
                return me._tabStrip.element;
            }
        };

        me.element.appendChild(me._tabBarContainer);

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
     * The DOM element representing the tab bar (Strip Root).
     * Exposed for DND strategies.
     *
     * @returns {HTMLElement}
     */
    get tabBar() {
        return this._tabStrip.element;
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
        const hasTabs = this._tabStrip.items.length > 0;
        if (hasTabs) {
            this._tabBarContainer.classList.remove('viewport__tab-bar--hidden');
        } else {
            this._tabBarContainer.classList.add('viewport__tab-bar--hidden');
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

        // Undock if docked
        if (windowInstance.isTabbed) {
            me.undockWindow(windowInstance); // Handles strip removal
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
     * If tabbed: Shows content, hides other tabs' content, highlights tab via TabStrip.
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
            // Tab Mode: Use TabStrip to set active visual state
            const wrapper = me._windowWrappers.get(windowInstance);
            if (wrapper) {
                me._tabStrip.setActiveItem(wrapper);
            }

            // Manage content visibility for tabbed windows
            me._windows.forEach(win => {
                if (win.isTabbed) {
                    const isActive = win === windowInstance;
                    win.element.classList.toggle('application-window--active-tab', isActive);
                }
            });
        } else {
            // Floating Mode
            me._updateZIndices();

            // Ensure background tab layer is not empty if tabs exist
            const hasActiveTab = me._windows.some(
                w => w.isTabbed && w.element.classList.contains('application-window--active-tab')
            );

            if (!hasActiveTab && me._tabStrip.items.length > 0) {
                // Find the last tabbed window to activate as background
                for (let i = me._windows.length - 1; i >= 0; i--) {
                    const win = me._windows[i];
                    if (win.isTabbed) {
                        win.element.classList.add('application-window--active-tab');
                        const wrapper = me._windowWrappers.get(win);
                        if (wrapper) me._tabStrip.setActiveItem(wrapper);
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

        // Prevent duplicate docking
        if (windowInstance.isTabbed && me._windowWrappers.has(windowInstance)) {
            // If index provided, move it
            if (index !== null) {
                const wrapper = me._windowWrappers.get(windowInstance);
                me._tabStrip.removeItem(wrapper);
                me._tabStrip.addItem(wrapper, index);
            }
            return;
        }

        windowInstance.setTabbed(true);

        // Create Wrapper and Add to Strip
        const wrapper = new WindowHeaderWrapper(windowInstance.header);
        me._windowWrappers.set(windowInstance, wrapper);

        me._tabStrip.addItem(wrapper, index);

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

        // Cleanup active classes manually
        windowInstance.element.classList.remove('application-window--active-tab');

        // Remove from TabStrip
        const wrapper = me._windowWrappers.get(windowInstance);
        if (wrapper) {
            me._tabStrip.removeItem(wrapper);
            me._windowWrappers.delete(windowInstance);
        }

        // Restore header to window structure if it was moved (DOM-wise TabStrip creates specific structure)
        // Note: VanillaStripAdapter moves elements. ApplicationWindowHeader.js handles "isTabMode" styles.
        // We need to ensure the header element is back in the window element if the strip moved it.
        // The VanillaStripAdapter uses mountItem, which appends to viewport.
        // So yes, we must move it back.
        if (windowInstance.element && windowInstance.header.element) {
            // VanillaWindowAdapter.mountHeader logic
            const winEl = windowInstance.element;
            const headEl = windowInstance.header.element;
            if (winEl.firstChild && winEl.firstChild !== headEl) {
                winEl.insertBefore(headEl, winEl.firstChild);
            } else if (!winEl.contains(headEl)) {
                winEl.appendChild(headEl);
            }
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
        const tabBarHeight = me._tabBarContainer.offsetHeight;
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
                // Verify removal in case logic was handled asynchronously
                if (
                    !document.body.contains(windowInstance.element) &&
                    !me.element.contains(windowInstance.element)
                ) {
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

        me._tabStrip.dispose();

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
