import { appBus } from '../../utils/EventBus.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { Panel } from '../../components/Panel/Panel.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { ToolbarContainerDropStrategy } from './ToolbarContainerDropStrategy.js';
import { DropZoneType, ItemType } from '../../constants/DNDTypes.js';
import { GhostManager } from './GhostManager.js';

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
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - _activePointerId {number | null} : The ID of the pointer initiating the drag.
 * - _activeDropZone {object | null} : The current DropZone instance being hovered.
 * - _ghostManager {GhostManager} : Manages the visual drag proxy.
 *
 * Typical usage:
 * const dds = DragDropService.getInstance();
 * dds.registerStrategy(DropZoneType.COLUMN, new ColumnDropStrategy());
 *
 * // In PanelHeader.js (Drag Source)
 * appBus.emit('dragstart', { item: panel, type: 'Panel', ... });
 *
 * // In Column.js (Drop Target)
 * this.dropZoneType = 'column';
 * this.element.dataset.dropzone = 'column';
 * this.element.dropZoneInstance = this;
 *
 * Events:
 * - Listens to (appBus): 'dragstart'
 * - Emits (appBus): 'dragend'
 *
 * Business rules implemented:
 * - Uses the "DOM Bridge" pattern with synthetic pointer events.
 * - Delegates visual "ghost" management to GhostManager.
 * - Applies constraints to panel movement via GhostManager updates.
 * - Centralizes magic strings using DNDTypes constants.
 *
 * Dependencies:
 * - ../../utils/EventBus.js
 * - ../../components/Panel/Panel.js
 * - ../../components/Panel/PanelGroup.js
 * - ../../utils/ThrottleRAF.js
 * - ./ToolbarContainerDropStrategy.js
 * - ../../constants/DNDTypes.js
 * - ./GhostManager.js
 */
export class DragDropService {
    /**
     * @type {DragDropService | null}
     * @private
     */
    static _instance = null;

    /**
     * Stores the item, type, and element being dragged.
     * @type {{
     * item: object | null,
     * type: string | null,
     * element: HTMLElement | null,
     * offsetX: number,
     * offsetY: number,
     * initialX: number,
     * initialY: number
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
        initialY: 0
    };

    /**
     * The single shared DOM element for drop feedback.
     * @type {HTMLElement}
     * @private
     */
    _placeholder = null;

    /**
     * Flag indicating if a drag operation is active.
     * @type {boolean}
     * @private
     */
    _isDragging = false;

    /**
     * Caches the current placeholder mode ('horizontal' | 'vertical')
     * to avoid redundant DOM writes.
     * @type {'horizontal' | 'vertical' | null}
     * @private
     */
    _placeholderMode = null;

    /**
     * Registry for the Strategy Pattern.
     * @type {Map<string, object>}
     * @private
     */
    _strategyRegistry = new Map();

    /**
     * Unique namespace for appBus listeners.
     * @type {string}
     * @private
     */
    _namespace = 'dnd-service';

    /**
     * The ID of the pointer initiating the drag.
     * @type {number | null}
     * @private
     */
    _activePointerId = null;

    /**
     * The current DropZone instance being hovered.
     * @type {object | null}
     * @private
     */
    _activeDropZone = null;

    /**
     * Manages the visual drag proxy (ghost).
     * @type {GhostManager}
     * @private
     */
    _ghostManager = null;

    /**
     * Bound handler for bus 'dragstart'.
     * @type {Function | null}
     * @private
     */
    _boundOnDragStart = null;

    /**
     * Bound handler for window 'pointermove'.
     * @type {Function | null}
     * @private
     */
    _boundOnPointerMove = null;

    /**
     * Bound handler for window 'pointerup'.
     * @type {Function | null}
     * @private
     */
    _boundOnPointerUp = null;

    /**
     * Throttled logic for visual updates and hit-testing.
     * @type {Function | null}
     * @private
     */
    _throttledMoveHandler = null;

    /**
     * Caches the last known pointer coordinates.
     * @type {{x: number, y: number}}
     * @private
     */
    _lastCoordinates = { x: 0, y: 0 };

    /**
     * Private constructor. Use getInstance().
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
     * Gets the single instance of the DragDropService.
     * @returns {DragDropService}
     */
    static getInstance() {
        if (!DragDropService._instance) {
            DragDropService._instance = new DragDropService();
        }
        return DragDropService._instance;
    }

    /**
     * Registers a DND strategy for a specific drop zone type.
     * @param {string} dropZoneType
     * @param {object} strategyInstance
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
     * Getter for the current drag state data.
     * @returns {object}
     */
    getDraggedData() {
        return this._dragState;
    }

    /**
     * Getter for the visual placeholder element.
     * @returns {HTMLElement}
     */
    getPlaceholder() {
        return this._placeholder;
    }

    /**
     * Checks if a drag operation is currently active.
     * @returns {boolean}
     */
    isDragging() {
        return this._isDragging;
    }

    /**
     * Hides the visual placeholder from the DOM.
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
     * Shows the visual placeholder in the specified mode.
     * @param {'horizontal' | 'vertical'} mode
     * @param {number|null} [dimension=null]
     */
    showPlaceholder(mode, dimension = null) {
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
     * Cleans up the service.
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);
        me._throttledMoveHandler?.cancel();

        me._ghostManager.destroy();

        if (me._activePointerId !== null) {
            me._removeGlobalListeners();
        }
        me._placeholder?.remove();
    }

    /**
     * Creates the shared placeholder DOM element.
     * @private
     */
    _createPlaceholder() {
        this._placeholder = document.createElement('div');
        this._placeholder.classList.add('container__placeholder');
    }

    /**
     * Initializes the 'dragstart' listener on the event bus.
     * @private
     */
    _initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };
        appBus.on('dragstart', me._boundOnDragStart, options);
    }

    /**
     * Clears the internal cache of all registered strategies.
     * @private
     */
    _clearStrategyCaches() {
        this._strategyRegistry.forEach(strategy => {
            if (typeof strategy.clearCache === 'function') {
                strategy.clearCache();
            }
        });
    }

    /**
     * Handles the start of a drag operation.
     * @param {object} payload
     * @private
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
        me._dragState.item = item;
        me._dragState.type = type;
        me._dragState.element = element;
        me._dragState.offsetX = offsetX || 0;
        me._dragState.offsetY = offsetY || 0;
        me._dragState.initialX = event.clientX;
        me._dragState.initialY = event.clientY;
        me._activePointerId = event.pointerId;

        me._lastCoordinates.x = event.clientX;
        me._lastCoordinates.y = event.clientY;

        document.body.classList.add('dnd-active');
        if (type) {
            document.body.classList.add(`dnd-type-${type.toLowerCase()}`);
        }
        element.classList.add('dragging');

        element.style.pointerEvents = 'none';

        if (
            me._dragState.item &&
            me._dragState.item._state &&
            me._dragState.item._state.isFloating
        ) {
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

        window.addEventListener('pointermove', me._boundOnPointerMove, { passive: false });
        window.addEventListener('pointerup', me._boundOnPointerUp);
        window.addEventListener('pointercancel', me._boundOnPointerUp);
    }

    /**
     * Handles global pointermove event.
     * @private
     */
    _onSyntheticPointerMove(event) {
        const me = this;
        if (event.pointerId !== me._activePointerId) {
            return;
        }

        event.preventDefault();

        me._lastCoordinates.x = event.clientX;
        me._lastCoordinates.y = event.clientY;

        me._throttledMoveHandler(event.clientX, event.clientY);
    }

    /**
     * Throttled move handler.
     * Updates ghost position via GhostManager and performs hit-testing.
     * @param {number} clientX - Pointer X.
     * @param {number} clientY - Pointer Y.
     * @private
     */
    _processMove(clientX, clientY) {
        const me = this;
        if (!me._isDragging) {
            return;
        }

        // 1. Calculate constraints (Bounds)
        let bounds = null;
        const isPanel =
            me._dragState.type === ItemType.PANEL || me._dragState.type === ItemType.PANEL_GROUP;

        if (isPanel) {
            const fpms = FloatingPanelManagerService.getInstance();
            bounds = fpms.getContainerBounds();
        }

        // 2. Update Ghost
        me._ghostManager.update(clientX, clientY, bounds);

        // 3. Hit Test
        const targetBelow = document.elementFromPoint(clientX, clientY);
        const dropZoneElement = targetBelow ? targetBelow.closest('[data-dropzone]') : null;
        const newDropZoneInstance = dropZoneElement ? dropZoneElement.dropZoneInstance : null;

        // 4. Handle Zone Transitions (Leave/Enter)
        if (newDropZoneInstance !== me._activeDropZone) {
            if (me._activeDropZone) {
                const oldStrategy = me._strategyRegistry.get(me._activeDropZone.dropZoneType);
                if (oldStrategy && typeof oldStrategy.handleDragLeave === 'function') {
                    const point = { x: clientX, y: clientY, target: targetBelow };
                    oldStrategy.handleDragLeave(point, me._activeDropZone, me._dragState, me);
                }
            }
            me._activeDropZone = newDropZoneInstance;
        }

        // 5. Handle Zone Over
        if (me._activeDropZone) {
            const strategy = me._strategyRegistry.get(me._activeDropZone.dropZoneType);
            if (strategy) {
                const point = { x: clientX, y: clientY, target: targetBelow };

                if (strategy._dropZoneCache && strategy._dropZoneCache.length === 0) {
                    if (typeof strategy.handleDragEnter === 'function') {
                        strategy.handleDragEnter(point, me._activeDropZone, me._dragState, me);
                    }
                }

                strategy.handleDragOver(point, me._activeDropZone, me._dragState, me);
                return;
            }
        }

        // 6. No zone active
        me.hidePlaceholder();
    }

    /**
     * Handles global pointerup event.
     * @private
     */
    _onSyntheticPointerUp(event) {
        const me = this;
        if (event.pointerId !== me._activePointerId) {
            return;
        }

        me._removeGlobalListeners();

        const clientX = event.clientX;
        const clientY = event.clientY;
        const targetBelow = document.elementFromPoint(clientX, clientY);

        let dropHandled = false;

        // Attempt drop on active zone
        if (me._activeDropZone && targetBelow) {
            const dropZoneElement = targetBelow.closest('[data-dropzone]');
            const dropZoneInstance = dropZoneElement ? dropZoneElement.dropZoneInstance : null;

            if (dropZoneInstance === me._activeDropZone) {
                const strategy = me._strategyRegistry.get(dropZoneInstance.dropZoneType);
                if (strategy) {
                    const point = { x: clientX, y: clientY, target: targetBelow };
                    dropHandled = strategy.handleDrop(point, dropZoneInstance, me._dragState, me);
                }
            }
        }

        // Fallback to Undock if not handled
        if (!dropHandled) {
            const floatingManager = FloatingPanelManagerService.getInstance();
            floatingManager.handleUndockDrop(me._dragState, clientX, clientY);
        }

        me._cleanupDrag();
        appBus.emit('dragend', { ...me._dragState });
    }

    /**
     * Resets state.
     * @private
     */
    _cleanupDrag() {
        const me = this;

        me._isDragging = false;
        me._activePointerId = null;
        me._activeDropZone = null;
        me._throttledMoveHandler.cancel();

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

        if (me._dragState.element) {
            me._dragState.element.classList.remove('dragging');
            me._dragState.element.style.pointerEvents = '';
            me._dragState.element.style.opacity = '';
        }

        me._clearStrategyCaches();

        me._dragState.item = null;
        me._dragState.element = null;
    }

    /**
     * Removes listeners.
     * @private
     */
    _removeGlobalListeners() {
        const me = this;
        window.removeEventListener('pointermove', me._boundOnPointerMove);
        window.removeEventListener('pointerup', me._boundOnPointerUp);
        window.removeEventListener('pointercancel', me._boundOnPointerUp);
    }
}
