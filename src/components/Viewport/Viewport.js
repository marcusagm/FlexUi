import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { DropZoneType } from '../../constants/DNDTypes.js';
import { ViewportFactory } from './ViewportFactory.js';
import { TabStrip } from '../Core/TabStrip.js';
import { UIElement } from '../../core/UIElement.js';
import { VanillaViewportAdapter } from '../../renderers/vanilla/VanillaViewportAdapter.js';
import { ResizeHandleManager } from '../../utils/ResizeHandleManager.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { PopoutManagerService } from '../../services/PopoutManagerService.js';

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
 * - height {number|null} : The height of the viewport (for vertical resizing in a column).
 * - _resizeObserver {ResizeObserver|null} : Observer for viewport dimension changes.
 * - _boundOnViewportResize {Function|null} : Throttled handler for resize events.
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
 * - Emits (appBus): EventTypes.LAYOUT_PANELGROUPS_CHANGED
 *
 * Business rules implemented:
 * - Acts as a 'viewport' drop zone type.
 * - Manages Z-Index layering (Standard vs Pinned) via adapter.
 * - Integrates TabStrip for docking functionality.
 * - Automatically hides the TabStrip when no windows are docked.
 * - Synchronizes Window focus with Tab selection.
 * - Supports 'Fill Space' layout mode managed by LayoutService.
 * - Supports vertical resizing when placed in a Column.
 * - Supports Popout windows (ignores focus/layout for external windows).
 * - Constrains floating windows within bounds upon viewport resize.
 *
 * Dependencies:
 * - {import('../Core/TabStrip.js').TabStrip}
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaViewportAdapter.js').VanillaViewportAdapter}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('./ViewportFactory.js').ViewportFactory}
 * - {import('../../utils/ResizeHandleManager.js').ResizeHandleManager}
 * - {import('../../utils/ThrottleRAF.js').throttleRAF}
 * - {import('../../services/PopoutManagerService.js').PopoutManagerService}
 */
export class Viewport extends UIElement {
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
     * @type {import('../Core/TabStrip.js').TabStrip}
     * @private
     */
    _tabStrip;

    /**
     * The height of the viewport.
     *
     * @type {number | null}
     * @private
     */
    _height = null;

    /**
     * Minimum height constraint.
     *
     * @type {number}
     * @private
     */
    _minHeight = 100;

    /**
     * Reference to the parent Column.
     *
     * @type {import('../Column/Column.js').Column | null}
     * @private
     */
    _column = null;

    /**
     * The unified manager for resize handles.
     *
     * @type {ResizeHandleManager | null}
     * @private
     */
    _resizeHandleManager = null;

    /**
     * Control flag for the visibility of the resize handle.
     *
     * @type {boolean}
     * @private
     */
    _resizeHandleVisible = true;

    /**
     * The throttled update function for resizing (height).
     *
     * @type {Function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * Observer for viewport dimension changes.
     *
     * @type {ResizeObserver | null}
     * @private
     */
    _resizeObserver = null;

    /**
     * Throttled handler for resize events.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnViewportResize = null;

    /**
     * The drop zone type identifier.
     *
     * @type {string}
     * @public
     */
    dropZoneType = DropZoneType.VIEWPORT;

    /**
     * Creates an instance of Viewport.
     *
     * @param {string} [id] - Optional ID.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer] - Optional renderer.
     */
    constructor(id = null, renderer = null) {
        super(id, renderer || new VanillaViewportAdapter());
        const me = this;

        me._namespace = `viewport-${me.id}`;

        me._tabStrip = new TabStrip(me.id + '-tabs', {
            orientation: 'horizontal',
            simpleMode: false
        });

        me._boundOnWindowFocus = me._onWindowFocus.bind(me);
        me._boundOnWindowClose = me._onWindowClose.bind(me);
        me._boundOnArrangeCascade = me.cascade.bind(me);
        me._boundOnArrangeTile = me.tile.bind(me);
        me._boundOnViewportResize = throttleRAF(me._onViewportResize.bind(me));

        me._throttledUpdate = throttleRAF(() => {
            me.updateHeight();
        });

        me.render();
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
     * The DOM element representing the tab bar (Strip Root).
     * Exposed for DND strategies.
     *
     * @returns {HTMLElement}
     */
    get tabBar() {
        return this._tabStrip.element;
    }

    /**
     * Accessor for the content container where windows float.
     *
     * @returns {HTMLElement|null}
     */
    get contentContainer() {
        const me = this;
        if (me.element) {
            return me.renderer.getContentContainer(me.element);
        }
        return null;
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
                console.warn(`[Viewport] invalid height assignment (${value}).`);
                return;
            }
            me._height = num;
        } else {
            me._height = null;
        }
        me.updateHeight();
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
     * Gets the parent column.
     *
     * @returns {import('../Column/Column.js').Column | null}
     */
    getColumn() {
        return this._column;
    }

    /**
     * Implementation of the rendering logic.
     * Uses the adapter to create the viewport structure.
     *
     * @returns {HTMLElement} The root viewport element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createViewportElement(me.id);

        element.dataset.dropzone = me.dropZoneType;
        element.dropZoneInstance = me;

        return element;
    }

    /**
     * Implementation of mount logic.
     * Mounts TabStrip and existing windows.
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

            const tabSlot = me.renderer.getTabContainerSlot(me.element);
            if (tabSlot) {
                me._tabStrip.mount(tabSlot);

                tabSlot.dataset.dropzone = DropZoneType.VIEWPORT_TAB_BAR;
                tabSlot.dropZoneInstance = {
                    dropZoneType: DropZoneType.VIEWPORT_TAB_BAR,
                    dockWindow: me.dockWindow.bind(me),
                    get tabBar() {
                        return me._tabStrip.element;
                    },
                    get windows() {
                        return me.windows;
                    }
                };
            }

            const contentContainer = me.contentContainer;
            if (contentContainer) {
                me._windows.forEach(windowInstance => {
                    if (!windowInstance.isMounted && !windowInstance.isPopout) {
                        windowInstance.mount(contentContainer);
                    }
                });
            }

            me._updateTabBarVisibility();
            me._updateDockedResizeHandle();
            me.updateHeight();

            // Initialize ResizeObserver to handle viewport resizing logic
            if (typeof ResizeObserver !== 'undefined') {
                me._resizeObserver = new ResizeObserver(() => {
                    if (me._boundOnViewportResize) {
                        me._boundOnViewportResize();
                    }
                });
                me._resizeObserver.observe(me.element);
            }
        }
    }

    /**
     * Implementation of unmount logic.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;

        if (me._resizeObserver) {
            me._resizeObserver.disconnect();
            me._resizeObserver = null;
        }

        if (me._boundOnViewportResize && typeof me._boundOnViewportResize.cancel === 'function') {
            me._boundOnViewportResize.cancel();
        }

        if (me._resizeHandleManager) {
            me._resizeHandleManager.destroy();
            me._resizeHandleManager = null;
        }

        if (me._throttledUpdate) {
            me._throttledUpdate.cancel();
        }

        if (me._tabStrip.isMounted) {
            me._tabStrip.unmount();
        }

        me._windows.forEach(windowInstance => {
            if (windowInstance.isMounted) {
                windowInstance.unmount();
            }
        });

        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
    }

    /**
     * Sets whether the viewport should fill the available space in the column.
     * Used by LayoutService.
     *
     * @param {boolean} fillsSpace - True to fill vertical space.
     * @returns {void}
     */
    setFillSpace(fillsSpace) {
        const me = this;
        if (me.element) {
            me.renderer.setFillSpace(me.element, fillsSpace);
        }
    }

    /**
     * Interface implementation for LayoutService compatibility.
     * Viewports do not have a collapse button, so this is a no-op.
     *
     * @param {boolean} disabled
     * @returns {void}
     */
    setCollapseButtonDisabled(disabled) {
        disabled;
    }

    /**
     * Sets whether the resize handle should be visible.
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
     * Updates the docked resize handle state based on visibility.
     *
     * @private
     * @returns {void}
     */
    _updateDockedResizeHandle() {
        const me = this;
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
                customClass: 'viewport-resize-handle',
                getConstraints: () => ({
                    minimumWidth: 0,
                    maximumWidth: Infinity,
                    minimumHeight: me._minHeight,
                    maximumHeight: Infinity,
                    containerRectangle: null
                }),
                onResize: ({ height }) => {
                    me._height = height;
                    if (me._throttledUpdate) me._throttledUpdate();
                },
                onEnd: () => me.requestLayoutUpdate()
            });
        }
    }

    /**
     * Updates the height styles of the element.
     *
     * @returns {void}
     */
    updateHeight() {
        const me = this;
        if (!me.element) return;

        if (me._height !== null) {
            me.renderer.updateStyles(me.element, {
                height: `${me._height}px`,
                flex: '0 0 auto'
            });
        } else {
            me.renderer.updateStyles(me.element, {
                height: 'auto',
                flex: '1 1 auto'
            });
        }

        me.renderer.updateStyles(me.element, { minHeight: `${me._minHeight}px` });
    }

    /**
     * Notifies the LayoutService that the structure has changed.
     *
     * @returns {void}
     */
    requestLayoutUpdate() {
        if (this._column) {
            appBus.emit(EventTypes.LAYOUT_PANELGROUPS_CHANGED, this._column);
        }
    }

    /**
     * Adds a window to the viewport and mounts it.
     * Handles both new windows and windows returning from Popout.
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance - The window to add.
     * @param {boolean} [doFocus=true] - Whether to focus the window immediately.
     * @returns {void}
     */
    addWindow(windowInstance, doFocus = true) {
        const me = this;
        if (!windowInstance) {
            console.warn('Viewport: Attempted to add invalid window.');
            return;
        }

        // Add to list if not already managed
        if (!me._windows.includes(windowInstance)) {
            me._windows.push(windowInstance);
        }

        // Mount check: Ensure it is mounted in the viewport's DOM if not popped out.
        // This is crucial for windows returning from Popout state (already in _windows but unmounted).
        if (
            me.isMounted &&
            me.contentContainer &&
            !windowInstance.isPopout &&
            !windowInstance.isMounted
        ) {
            windowInstance.mount(me.contentContainer);
        }

        if (doFocus) {
            me.focusWindow(windowInstance);
        }
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

        const wasActive = me._activeWindow === windowInstance;
        const remainingActiveWindow = me._activeWindow;

        if (windowInstance.isTabbed && windowInstance.header) {
            me._tabStrip.removeItem(windowInstance.header);
            if (windowInstance.element) {
                windowInstance.element.classList.remove('application-window--active-tab');
            }
        }

        me._windows.splice(index, 1);
        windowInstance.dispose();

        me._updateTabBarVisibility();

        if (wasActive) {
            me._activeWindow = null;
            if (me._windows.length > 0) {
                // Find next candidate (not popped out preferrably)
                const next =
                    me._windows.find((w, i) => i >= index && !w.isPopout) ||
                    me._windows.find(w => !w.isPopout);

                if (next) {
                    me.focusWindow(next, true);
                }
            }
        } else {
            if (remainingActiveWindow) {
                me.focusWindow(remainingActiveWindow, true);
            }
        }
    }

    /**
     * Focuses a specific window.
     * If the window is in Popout mode, delegates focus to the native window.
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance - The window to focus.
     * @param {boolean} [force=false] - If true, re-asserts focus even if already active.
     * @returns {void}
     */
    focusWindow(windowInstance, force = false) {
        const me = this;
        if (!me._windows.includes(windowInstance)) {
            return;
        }

        // Handle Popout Focus
        if (windowInstance.isPopout) {
            const popout = PopoutManagerService.getInstance().getPopoutFor(windowInstance);
            if (popout && popout.nativeWindow) {
                popout.nativeWindow.focus();
            }
            return;
        }

        const alreadyActive = me._activeWindow === windowInstance;

        if (alreadyActive && !force) {
            return;
        }

        if (me._activeWindow && me._activeWindow !== windowInstance) {
            me._activeWindow.isFocused = false;
        }

        me._activeWindow = windowInstance;
        windowInstance.isFocused = true;

        if (windowInstance.element) {
            windowInstance.element.focus({ preventScroll: true });
        }

        const index = me._windows.indexOf(windowInstance);
        if (index > -1) {
            me._windows.splice(index, 1);
            me._windows.push(windowInstance);
        }

        if (windowInstance.isTabbed) {
            if (windowInstance.header) {
                me._tabStrip.setActiveItem(windowInstance.header);
            }

            me._windows.forEach(win => {
                if (win.isTabbed && !win.isPopout) {
                    const isActive = win === windowInstance;
                    win.activeTab = isActive;
                }
            });
        } else {
            me._updateZIndices();

            const hasActiveTab = me._windows.some(
                w =>
                    w.isTabbed &&
                    !w.isPopout &&
                    w.element &&
                    w.element.classList.contains('application-window--active-tab')
            );

            if (!hasActiveTab && me._tabStrip.items.length > 0) {
                for (let i = me._windows.length - 1; i >= 0; i--) {
                    const win = me._windows[i];
                    if (win.isTabbed && !win.isPopout) {
                        win.activeTab = true;
                        if (win.header) {
                            me._tabStrip.setActiveItem(win.header);
                        }
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
        if (!windowInstance.header) return;

        if (windowInstance.isTabbed && me._tabStrip.items.includes(windowInstance.header)) {
            if (index !== null) {
                me._tabStrip.removeItem(windowInstance.header);
                me._tabStrip.addItem(windowInstance.header, index);
            }
            return;
        }

        windowInstance.setTabbed(true);

        me._tabStrip.addItem(windowInstance.header, index);

        me._updateTabBarVisibility();
        me.focusWindow(windowInstance, true);
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

        const wasActiveTab = windowInstance.activeTab;

        windowInstance.setTabbed(false);
        windowInstance.activeTab = false;

        if (windowInstance.header) {
            me._tabStrip.removeItem(windowInstance.header);
        }

        windowInstance.restoreHeader();

        windowInstance.x = x;
        windowInstance.y = y;
        windowInstance.constrainToParent();

        if (wasActiveTab) {
            const remainingTabs = me._windows.filter(
                win => win.isTabbed && win !== windowInstance && !win.isPopout
            );
            if (remainingTabs.length > 0) {
                const newActive = remainingTabs[remainingTabs.length - 1];
                newActive.activeTab = true;
                if (newActive.header) {
                    me._tabStrip.setActiveItem(newActive.header);
                }
            }
        }

        me._updateTabBarVisibility();
        me.focusWindow(windowInstance, true);
    }

    /**
     * Arranges all windows in a cascading pattern.
     * Ignores windows currently in Popout mode.
     *
     * @returns {void}
     */
    cascade() {
        const me = this;
        const offset = 30;
        let count = 0;

        me._windows.forEach(windowInstance => {
            if (windowInstance.isTabbed || windowInstance.isPopout) return;
            if (windowInstance.isMaximized) windowInstance.toggleMaximize();

            const x = count * offset;
            const y = count * offset;

            windowInstance.x = x;
            windowInstance.y = y;

            count++;
        });
    }

    /**
     * Arranges all windows in a tile pattern.
     * Ignores windows currently in Popout mode.
     *
     * @returns {void}
     */
    tile() {
        const me = this;
        const floatingWindows = me._windows.filter(w => !w.isTabbed && !w.isPopout);
        const count = floatingWindows.length;
        if (count === 0) return;

        const dimensions = me.renderer.getDimensions(me.element);
        const tabBarHeight =
            me._tabStrip.element && me._tabStrip.isVisible ? me._tabStrip.element.offsetHeight : 0;

        const areaWidth = dimensions.width;
        const areaHeight = dimensions.height - tabBarHeight;

        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);

        const cellWidth = areaWidth / cols;
        const cellHeight = areaHeight / rows;

        floatingWindows.forEach((windowInstance, index) => {
            if (windowInstance.isMaximized) windowInstance.toggleMaximize();

            const colIndex = index % cols;
            const rowIndex = Math.floor(index / cols);

            const x = colIndex * cellWidth;
            const y = rowIndex * cellHeight + tabBarHeight;

            windowInstance.x = x;
            windowInstance.y = y;
            windowInstance.width = cellWidth;
            windowInstance.height = cellHeight;
        });
    }

    /**
     * Cleans up listeners and removes the viewport.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        [...me._windows].forEach(windowInstance => windowInstance.dispose());
        me._windows = [];

        if (me._tabStrip) {
            me._tabStrip.dispose();
        }

        super.dispose();
    }

    /**
     * Serializes the viewport and its windows to JSON.
     * Includes popout windows in the serialization so they can be restored
     * correctly (geometry is synced by PopoutManagerService).
     *
     * @returns {object}
     */
    toJSON() {
        const me = this;
        return {
            type: DropZoneType.VIEWPORT,
            height: me._height,
            windows: me._windows.map(windowInstance => windowInstance.toJSON())
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
        [...me._windows].forEach(windowInstance => me.removeWindow(windowInstance));

        if (data.height !== undefined) {
            me.height = data.height;
        }

        if (data.windows && Array.isArray(data.windows)) {
            const factory = ViewportFactory.getInstance();
            data.windows.forEach(winData => {
                const win = factory.createWindow(winData);
                if (win) {
                    // Use state from JSON to determine initial mode
                    const isTabbed = winData.state ? winData.state.tabbed : false;
                    const isPopout = winData.state ? winData.state.isPopout : false;

                    me.addWindow(win, !isTabbed && !isPopout);

                    if (isTabbed) {
                        me.dockWindow(win);
                    }

                    if (isPopout) {
                        PopoutManagerService.getInstance().popoutWindow(win);
                    }
                }
            });
        }

        if (me._windows.length > 0) {
            // Focus the last non-popout window
            const activeWindow = me._windows
                .slice()
                .reverse()
                .find(w => !w.isPopout);
            if (activeWindow) {
                me.focusWindow(activeWindow, true);
            }
        }
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

        if (me._tabStrip) {
            me._tabStrip.onSelectionChange(header => {
                if (header && header.windowInstance) {
                    me.focusWindow(header.windowInstance);
                }
            });
        }
    }

    /**
     * Updates the visibility of the tab bar based on docked windows.
     *
     * @private
     * @returns {void}
     */
    _updateTabBarVisibility() {
        const me = this;
        if (me.element) {
            const hasTabs = me._tabStrip.items.length > 0;
            me.renderer.setTabBarVisible(me.element, hasTabs);
        }
    }

    /**
     * Recalculates and applies z-indices for all windows.
     *
     * @private
     * @returns {void}
     */
    _updateZIndices() {
        const me = this;
        const standardElements = [];
        const pinnedElements = [];

        me._windows.forEach(win => {
            if (win.isTabbed || win.isPopout || !win.element) return;
            if (win.isPinned) {
                pinnedElements.push(win.element);
            } else {
                standardElements.push(win.element);
            }
        });

        me.renderer.updateZIndices(standardElements, me._baseZIndex);
        me.renderer.updateZIndices(pinnedElements, me._alwaysOnTopZIndex);
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
     * Checks the return value of close() to respect prevention (dirty state).
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance
     * @private
     * @returns {void}
     */
    _onWindowClose(windowInstance) {
        const me = this;
        if (me._windows.includes(windowInstance)) {
            windowInstance.close().then(didClose => {
                // Only remove if close was successful (true)
                if (didClose && me._windows.includes(windowInstance)) {
                    me.removeWindow(windowInstance);
                }
            });
        }
    }

    /**
     * Handles resize events on the Viewport element.
     * Ensures all floating windows stay within the new bounds of the viewport.
     *
     * @private
     * @returns {void}
     */
    _onViewportResize() {
        const me = this;
        me._windows.forEach(win => {
            // Apply constraint logic only for floating windows (not tabbed, not popout)
            if (!win.isTabbed && !win.isPopout && typeof win.constrainToParent === 'function') {
                win.constrainToParent();
            }
        });
    }
}
