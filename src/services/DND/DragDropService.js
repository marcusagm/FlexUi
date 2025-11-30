import { Event } from '../../utils/Event.js';
import { FastDOM } from '../../utils/FastDOM.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { ItemType } from '../../constants/DNDTypes.js';
import { GhostManager } from './GhostManager.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * A Singleton service that manages the global state and logic for
 * Drag-and-Drop (D&D) operations. It implements the Strategy pattern,
 * delegating behavior to registered strategy classes based on the
 * 'dropZoneType' of the target.
 *
 * It acts as the central coordinator for the drag lifecycle, handling:
 * - Event listeners (Drag Start, Pointer Move, Pointer Up).
 * - Drop Zone detection (Hit Testing).
 * - Strategy delegation for Drop Over and Drop events.
 * - Visual feedback management (delegated to GhostManager).
 *
 * Properties summary:
 * - _instance {DragDropService | null} : The private static instance.
 * - _dragState {object} : Stores the item, type, and element being dragged.
 * - _placeholder {HTMLElement} : The single shared DOM element used for drop feedback.
 * - _isDragging {boolean} : Flag indicating if a drag operation is active.
 * - _placeholderMode {string | null} : Caches the current placeholder mode.
 * - _strategyRegistry {Map} : Maps dropZoneType (string) to Strategy instances.
 * - _namespace {string} : Unique namespace for Event listeners.
 * - _activePointerId {number | null} : The ID of the pointer initiating the drag.
 * - _activeDropZone {object | null} : The current DropZone instance being hovered.
 * - _ghostManager {GhostManager} : Manages the visual drag proxy.
 * - _boundOnDragStart {Function | null} : Bound handler for bus dragstart.
 * - _boundOnPointerMove {Function | null} : Bound handler for window pointermove.
 * - _boundOnPointerUp {Function | null} : Bound handler for window pointerup.
 * - _throttledMoveHandler {Function | null} : Throttled logic for visual updates and hit-testing.
 * - _lastCoordinates {object} : Caches the last known pointer coordinates.
 * - _activeWindow {Window | null} : The window where the drag originated.
 *
 * Typical usage:
 * const dds = DragDropService.getInstance();
 * dds.registerStrategy(DropZoneType.COLUMN, new ColumnDropStrategy());
 *
 * Events:
 * - Listens to (Event): EventTypes.DND_DRAG_START
 * - Emits (Event): EventTypes.DND_DRAG_END
 *
 * Business rules implemented:
 * - Uses the "DOM Bridge" pattern with synthetic pointer events.
 * - Delegates visual "ghost" management to GhostManager.
 * - Applies constraints to panel movement via GhostManager updates.
 * - Centralizes magic strings using DNDTypes constants.
 * - Supports Window constraints relative to their Viewport.
 * - Supports multi-window Drag and Drop (Popout).
 *
 * Dependencies:
 * - ../../utils/Event.js
 * - ../../components/Panel/Panel.js
 * - ../../components/Panel/PanelGroup.js
 * - ../../utils/ThrottleRAF.js
 * - ./ToolbarContainerDropStrategy.js
 * - ../../constants/DNDTypes.js
 * - ./GhostManager.js
 * - ../../constants/EventTypes.js
 */
export class DragDropService {
    /**
     * The private static instance.
     *
     * @type {DragDropService | null}
     * @private
     */
    static _instance = null;

    /**
     * Stores the item, type, and element being dragged.
     *
     * @type {{
     * item: object | null,
     * type: string | null,
     * element: HTMLElement | null,
     * offsetX: number,
     * offsetY: number,
     * initialX: number,
     * initialY: number,
     * initialScreenX: number,
     * initialScreenY: number
     * }}
     * @private
     */
    _dragState = {
        item: null,
        type: null,
        element: null,
        offsetX: 0,
        offsetY: 0,
        initialX: 0,
        initialY: 0,
        initialScreenX: 0,
        initialScreenY: 0
    };

    /**
     * The single shared DOM element for drop feedback.
     *
     * @type {HTMLElement}
     * @private
     */
    _placeholder = null;

    /**
     * Flag indicating if a drag operation is active.
     *
     * @type {boolean}
     * @private
     */
    _isDragging = false;

    /**
     * Caches the current placeholder mode ('horizontal' | 'vertical')
     * to avoid redundant DOM writes.
     *
     * @type {'horizontal' | 'vertical' | null}
     * @private
     */
    _placeholderMode = null;

    /**
     * Registry for the Strategy Pattern.
     *
     * @type {Map<string, object>}
     * @private
     */
    _strategyRegistry = new Map();

    /**
     * Unique namespace for Event listeners.
     *
     * @type {string}
     * @private
     */
    _namespace = 'dnd-service';

    /**
     * The ID of the pointer initiating the drag.
     *
     * @type {number | null}
     * @private
     */
    _activePointerId = null;

    /**
     * The current DropZone instance being hovered.
     *
     * @type {object | null}
     * @private
     */
    _activeDropZone = null;

    /**
     * Manages the visual drag proxy (ghost).
     *
     * @type {GhostManager}
     * @private
     */
    _ghostManager = null;

    /**
     * Bound handler for bus 'dragstart'.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnDragStart = null;

    /**
     * Bound handler for window 'pointermove'.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnPointerMove = null;

    /**
     * Bound handler for window 'pointerup'.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnPointerUp = null;

    /**
     * Throttled logic for visual updates and hit-testing.
     *
     * @type {Function | null}
     * @private
     */
    _throttledMoveHandler = null;

    /**
     * Caches the last known pointer coordinates.
     *
     * @type {{x: number, y: number}}
     * @private
     */
    _lastCoordinates = { x: 0, y: 0 };

    /**
     * The window where the drag originated.
     *
     * @type {Window | null}
     * @private
     */
    _activeWindow = null;

    /**
     * Private constructor. Use getInstance().
     *
     * @private
     */
    constructor() {
        if (DragDropService._instance) {
            console.warn('DragDropService instance already exists. Use getInstance().');
            return DragDropService._instance;
        }
        DragDropService._instance = this;

        const me = this;
        me._ghostManager = new GhostManager();
        me._createPlaceholder();

        me._boundOnDragStart = me._onDragStart.bind(me);
        me._boundOnPointerMove = me._onSyntheticPointerMove.bind(me);
        me._boundOnPointerUp = me._onSyntheticPointerUp.bind(me);

        me._throttledMoveHandler = throttleRAF(me._processMove.bind(me));

        me._initEventListeners();
    }

    /**
     * Description:
     * Gets the single instance of the DragDropService.
     *
     * @returns {DragDropService} The singleton instance.
     */
    static getInstance() {
        if (!DragDropService._instance) {
            DragDropService._instance = new DragDropService();
        }
        return DragDropService._instance;
    }

    /**
     * Description:
     * Registers a DND strategy for a specific drop zone type.
     *
     * @param {string} dropZoneType - The type of the drop zone (e.g., 'column').
     * @param {object} strategyInstance - The instance of the drop strategy.
     * @returns {void}
     */
    registerStrategy(dropZoneType, strategyInstance) {
        if (
            !strategyInstance ||
            typeof strategyInstance.handleDragOver !== 'function' ||
            typeof strategyInstance.handleDrop !== 'function'
        ) {
            console.warn(`DragDropService: Invalid strategy for "${dropZoneType}".`);
            return;
        }
        this._strategyRegistry.set(dropZoneType, strategyInstance);
    }

    /**
     * Description:
     * Getter for the current drag state data.
     *
     * @returns {object} The current drag state data.
     */
    getDraggedData() {
        return this._dragState;
    }

    /**
     * Description:
     * Getter for the visual placeholder element.
     *
     * @returns {HTMLElement} The placeholder element.
     */
    getPlaceholder() {
        return this._placeholder;
    }

    /**
     * Description:
     * Checks if a drag operation is currently active.
     *
     * @returns {boolean} True if dragging, false otherwise.
     */
    isDragging() {
        return this._isDragging;
    }

    /**
     * Description:
     * Hides the visual placeholder from the DOM.
     *
     * @returns {void}
     */
    hidePlaceholder() {
        const me = this;
        if (me._placeholder.parentElement) {
            me._placeholder.parentElement.removeChild(me._placeholder);
        }
        me._placeholder.className = 'container__placeholder';
        me._placeholder.style.height = '';
        me._placeholder.style.width = '';
        me._placeholderMode = null;
    }

    /**
     * Description:
     * Shows the visual placeholder in the specified mode.
     *
     * @param {'horizontal' | 'vertical'} mode - The orientation of the placeholder.
     * @param {number|null} [dimension=null] - Optional dimension hint.
     * @returns {void}
     */
    showPlaceholder(mode) {
        const me = this;
        if (mode === me._placeholderMode) {
            return;
        }

        me.hidePlaceholder();

        if (mode === 'horizontal') {
            me._placeholder.classList.add('container__placeholder--horizontal');
        } else if (mode === 'vertical') {
            me._placeholder.classList.add('container__placeholder--vertical');
        }

        me._placeholderMode = mode;
    }

    /**
     * Description:
     * Cleans up the service.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        Event.offByNamespace(me._namespace);
        me._throttledMoveHandler?.cancel();

        me._ghostManager.destroy();

        if (me._activePointerId !== null) {
            me._removeGlobalListeners();
        }
        me._placeholder?.remove();
    }

    /**
     * Description:
     * Creates the shared placeholder DOM element.
     *
     * @private
     * @returns {void}
     */
    _createPlaceholder() {
        this._placeholder = document.createElement('div');
        this._placeholder.classList.add('container__placeholder');
    }

    /**
     * Description:
     * Initializes the 'dragstart' listener on the event bus.
     *
     * @private
     * @returns {void}
     */
    _initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };
        Event.on(EventTypes.DND_DRAG_START, me._boundOnDragStart, options);
    }

    /**
     * Description:
     * Clears the internal cache of all registered strategies.
     *
     * @private
     * @returns {void}
     */
    _clearStrategyCaches() {
        this._strategyRegistry.forEach(strategy => {
            if (typeof strategy.clearCache === 'function') {
                strategy.clearCache();
            }
        });
    }

    /**
     * Description:
     * Handles the start of a drag operation.
     *
     * @param {object} payload - The event payload from the drag source.
     * @private
     * @returns {void}
     */
    _onDragStart(payload) {
        const me = this;
        if (me._isDragging) {
            return;
        }

        const { item, type, element, event, offsetX, offsetY } = payload;
        if (!event || !element) {
            return;
        }

        me._isDragging = true;
        me._activeWindow = event.view || window;

        me._dragState.item = item;
        me._dragState.type = type;
        me._dragState.element = element;
        me._dragState.offsetX = offsetX || 0;
        me._dragState.offsetY = offsetY || 0;
        me._dragState.initialX = event.clientX;
        me._dragState.initialY = event.clientY;
        me._dragState.initialScreenX = event.screenX;
        me._dragState.initialScreenY = event.screenY;
        me._activePointerId = event.pointerId;

        me._lastCoordinates.x = event.clientX;
        me._lastCoordinates.y = event.clientY;

        FastDOM.mutate(() => {
            document.body.classList.add('dnd-active');
            if (type) {
                document.body.classList.add(`dnd-type-${type.toLowerCase()}`);
            }
            element.classList.add('dragging');

            element.style.pointerEvents = 'none';

            const isFloatingPanel =
                me._dragState.item &&
                me._dragState.item._state &&
                me._dragState.item._state.isFloating;

            const isWindow = me._dragState.type === ItemType.WINDOW;

            if (isFloatingPanel || isWindow) {
                element.style.opacity = '0';
            }

            me._ghostManager.create(
                element,
                event.clientX,
                event.clientY,
                me._dragState.offsetX,
                me._dragState.offsetY
            );

            me._clearStrategyCaches();

            me._activeWindow.addEventListener('pointermove', me._boundOnPointerMove, {
                passive: false
            });
            me._activeWindow.addEventListener('pointerup', me._boundOnPointerUp);
            me._activeWindow.addEventListener('pointercancel', me._boundOnPointerUp);
        });
    }

    /**
     * Description:
     * Handles global pointermove event.
     *
     * @param {PointerEvent} event - The native pointer move event.
     * @private
     * @returns {void}
     */
    _onSyntheticPointerMove(event) {
        const me = this;
        if (event.pointerId !== me._activePointerId) {
            return;
        }

        event.preventDefault();

        const coords = me._getGlobalClientCoordinates(event);

        me._lastCoordinates.x = coords.x;
        me._lastCoordinates.y = coords.y;

        me._throttledMoveHandler(coords.x, coords.y);
    }

    /**
     * Description:
     * Throttled move handler.
     * Updates ghost position via GhostManager and performs hit-testing.
     *
     * @param {number} clientX - Pointer X coordinate (normalized to Main Window).
     * @param {number} clientY - Pointer Y coordinate (normalized to Main Window).
     * @private
     * @returns {void}
     */
    _processMove(clientX, clientY) {
        const me = this;
        if (!me._isDragging) {
            return;
        }

        FastDOM.measure(() => {
            let bounds = null;
            const isPanel =
                me._dragState.type === ItemType.PANEL ||
                me._dragState.type === ItemType.PANEL_GROUP;

            const isWindow = me._dragState.type === ItemType.WINDOW;

            if (me._activeWindow === window) {
                if (isPanel) {
                    const fpms = FloatingPanelManagerService.getInstance();
                    bounds = fpms.getContainerBounds();
                } else if (isWindow && me._dragState.element) {
                    const viewport = me._dragState.element.closest('.viewport');
                    if (viewport) {
                        bounds = viewport.getBoundingClientRect();
                    }
                }
            }

            const targetBelow = document.elementFromPoint(clientX, clientY);
            const dropZoneElement = targetBelow ? targetBelow.closest('[data-dropzone]') : null;
            const newDropZoneInstance = dropZoneElement ? dropZoneElement.dropZoneInstance : null;

            FastDOM.mutate(() => {
                me._ghostManager.update(clientX, clientY, bounds);

                if (newDropZoneInstance !== me._activeDropZone) {
                    if (me._activeDropZone) {
                        const oldStrategy = me._strategyRegistry.get(
                            me._activeDropZone.dropZoneType
                        );
                        if (oldStrategy && typeof oldStrategy.handleDragLeave === 'function') {
                            const point = { x: clientX, y: clientY, target: targetBelow };
                            oldStrategy.handleDragLeave(
                                point,
                                me._activeDropZone,
                                me._dragState,
                                me
                            );
                        }
                    }
                    me._activeDropZone = newDropZoneInstance;
                }

                if (me._activeDropZone) {
                    const strategy = me._strategyRegistry.get(me._activeDropZone.dropZoneType);
                    if (strategy) {
                        const point = { x: clientX, y: clientY, target: targetBelow };

                        if (strategy._dropZoneCache && strategy._dropZoneCache.length === 0) {
                            if (typeof strategy.handleDragEnter === 'function') {
                                strategy.handleDragEnter(
                                    point,
                                    me._activeDropZone,
                                    me._dragState,
                                    me
                                );
                            }
                        }

                        strategy.handleDragOver(point, me._activeDropZone, me._dragState, me);
                        return;
                    }
                }

                me.hidePlaceholder();
            });
        });
    }

    /**
     * Description:
     * Handles global pointerup event.
     *
     * @param {PointerEvent} event - The native pointer up event.
     * @private
     * @returns {void}
     */
    _onSyntheticPointerUp(event) {
        const me = this;
        if (event.pointerId !== me._activePointerId) {
            return;
        }

        me._removeGlobalListeners();

        const coords = me._getGlobalClientCoordinates(event);
        const targetBelow = document.elementFromPoint(coords.x, coords.y);

        let dropHandled = false;

        if (me._activeDropZone && targetBelow) {
            const dropZoneElement = targetBelow.closest('[data-dropzone]');
            const dropZoneInstance = dropZoneElement ? dropZoneElement.dropZoneInstance : null;

            if (dropZoneInstance === me._activeDropZone) {
                const strategy = me._strategyRegistry.get(dropZoneInstance.dropZoneType);
                if (strategy) {
                    const point = { x: coords.x, y: coords.y, target: targetBelow };
                    dropHandled = strategy.handleDrop(point, dropZoneInstance, me._dragState, me);
                }
            }
        }

        if (!dropHandled) {
            if (
                me._dragState.type === ItemType.PANEL ||
                me._dragState.type === ItemType.PANEL_GROUP
            ) {
                const floatingManager = FloatingPanelManagerService.getInstance();
                floatingManager.handleUndockDrop(me._dragState, coords.x, coords.y);
            }
        }

        me._cleanupDrag();
        Event.emit(EventTypes.DND_DRAG_END, { ...me._dragState });
    }

    /**
     * Description:
     * Calculates the client coordinates relative to the Main Window,
     * even if the event originated in a Popout. Includes sanity checks
     * for DevTools interference.
     *
     * @param {PointerEvent} event - The source event.
     * @returns {{x: number, y: number}} The normalized coordinates.
     * @private
     */
    _getGlobalClientCoordinates(event) {
        const me = this;
        if (me._activeWindow === window) {
            return { x: event.clientX, y: event.clientY };
        }

        const diffW = window.outerWidth - window.innerWidth;
        const diffH = window.outerHeight - window.innerHeight;

        let borderX = diffW / 2;

        let borderY = diffH - borderX;

        const safeFallbackX = 30;
        if (borderX < 0 || borderX > safeFallbackX) {
            borderX = 0;
        }

        const safeFallbackYCheck = 150;
        const safeFallbackY = 120;
        if (borderY < 0 || borderY > safeFallbackYCheck) {
            borderY = safeFallbackY;
        }

        const mainClientX = event.screenX - window.screenX - borderX;
        const mainClientY = event.screenY - window.screenY - borderY;

        return { x: mainClientX, y: mainClientY };
    }

    /**
     * Description:
     * Resets state.
     *
     * @private
     * @returns {void}
     */
    _cleanupDrag() {
        const me = this;

        me._isDragging = false;
        me._activePointerId = null;
        me._activeDropZone = null;
        me._throttledMoveHandler.cancel();

        const elementToReset = me._dragState.element;

        FastDOM.mutate(() => {
            me._ghostManager.destroy();
            me.hidePlaceholder();

            document.body.classList.remove('dnd-active');
            const classesToRemove = [];
            document.body.classList.forEach(cls => {
                if (cls.startsWith('dnd-type-')) {
                    classesToRemove.push(cls);
                }
            });
            classesToRemove.forEach(cls => document.body.classList.remove(cls));

            if (elementToReset) {
                elementToReset.classList.remove('dragging');
                elementToReset.style.pointerEvents = '';
                elementToReset.style.opacity = '';
            }
        });

        me._clearStrategyCaches();

        me._dragState.item = null;
        me._dragState.element = null;
        me._activeWindow = null;
    }

    /**
     * Description:
     * Removes global listeners from the active window.
     *
     * @private
     * @returns {void}
     */
    _removeGlobalListeners() {
        const me = this;
        if (me._activeWindow) {
            me._activeWindow.removeEventListener('pointermove', me._boundOnPointerMove);
            me._activeWindow.removeEventListener('pointerup', me._boundOnPointerUp);
            me._activeWindow.removeEventListener('pointercancel', me._boundOnPointerUp);
        }
    }
}
