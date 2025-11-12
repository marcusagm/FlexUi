import { appBus } from '../../utils/EventBus.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';

/**
 * Description:
 * A Singleton service that manages the global state and logic for
 * Drag-and-Drop (D&D) operations. It implements the Strategy pattern,
 * delegating behavior to registered strategy classes (ColumnDropStrategy,
 * RowDropStrategy, etc.) based on the 'dropZoneType' of the target.
 *
 * It also implements the "DOM Bridge" pattern for DND, attaching only 4
 * native listeners to the document body and using event delegation
 * to find the correct drop zone instance.
 *
 * Adds a 'dnd-active' class to the document body during drag operations so CSS
 * can disable pointer-events on resize handles, preventing event flickering.
 *
 * Properties summary:
 * - _instance {DragDropService | null} : The private static instance.
 * - _dragState {object} : Stores the item, type, and element being dragged.
 * - _placeholder {HTMLElement} : The single shared DOM element used for drop feedback.
 * - _isDragging {boolean} : Flag indicating if a drag operation is active.
 * - _placeholderMode {string | null} : Caches the current placeholder mode ('horizontal'/'vertical').
 * - _strategyRegistry {Map} : Maps dropZoneType (string) to Strategy instances.
 * - _namespace {string} : Unique namespace for appBus listeners.
 *
 * Typical usage:
 * // In App.js
 * const dds = DragDropService.getInstance();
 * dds.registerStrategy('column', new ColumnDropStrategy());
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
 * - Listens to (appBus): 'dragstart', 'dragend'
 *
 * Dependencies:
 * - utils/EventBus.js
 * - (Strategies are injected by App.js)
 */
export class DragDropService {
    /**
     * @type {DragDropService | null}
     * @private
     */
    static _instance = null;

    /**
     * Stores the item, type, and element being dragged.
     * @type {{item: object | null, type: string | null, element: HTMLElement | null}}
     * @private
     */
    _dragState = { item: null, type: null, element: null };

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
     * @type {Function | null}
     * @private
     */
    _boundOnDragStart = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnDragEnd = null;

    /**
     * @private
     */
    constructor() {
        if (DragDropService._instance) {
            console.warn('DragDropService instance already exists. Use getInstance().');
            return DragDropService._instance;
        }
        DragDropService._instance = this;

        const me = this;
        me._createPlaceholder();

        me._boundOnDragStart = me._onDragStart.bind(me);
        me._boundOnDragEnd = me._onDragEnd.bind(me);

        me._initEventListeners();
    }

    /**
     * Gets the single instance of the service.
     * @returns {DragDropService}
     */
    static getInstance() {
        if (!DragDropService._instance) {
            DragDropService._instance = new DragDropService();
        }
        return DragDropService._instance;
    }

    /**
     * Hides the placeholder by removing it from the DOM
     * and resetting its state.
     * @returns {void}
     */
    hidePlaceholder() {
        const me = this;
        if (me._placeholder.parentElement) {
            me._placeholder.parentElement.removeChild(me._placeholder);
        }
        me._placeholder.className = 'container__placeholder';
        me._placeholder.style.height = '';
        me._placeholderMode = null;
    }

    /**
     * Shows the placeholder in a specific mode ('horizontal' or 'vertical').
     * @param {'horizontal' | 'vertical'} mode - The display mode.
     * @param {number | null} [height=null] - The height (for horizontal mode).
     * @returns {void}
     */
    showPlaceholder(mode, height = null) {
        const me = this;
        if (mode === me._placeholderMode) {
            if (mode === 'horizontal' && height && me._placeholder.style.height !== `${height}px`) {
                // me._placeholder.style.height = `${height}px`;
            }
            return;
        }

        me.hidePlaceholder();

        if (mode === 'horizontal') {
            me._placeholder.classList.add('container__placeholder--horizontal');
            if (height) {
                // me._placeholder.style.height = `${height}px`;
            }
        } else if (mode === 'vertical') {
            me._placeholder.classList.add('container__placeholder--vertical');
        }

        me._placeholderMode = mode;
    }

    /**
     * Registers a DND strategy for a specific drop zone type.
     * @param {string} dropZoneType - The identifier (e.g., 'column').
     * @param {object} strategyInstance - The instance of the strategy class.
     * @returns {void}
     */
    registerStrategy(dropZoneType, strategyInstance) {
        const me = this;
        if (!dropZoneType) {
            console.warn('DragDropService: Attempted to register strategy without dropZoneType.');
            return;
        }
        if (
            !strategyInstance ||
            (typeof strategyInstance.handleDrop !== 'function' &&
                typeof strategyInstance.handleDragOver !== 'function')
        ) {
            console.warn(`DragDropService: Invalid strategy for "${dropZoneType}".`);
            return;
        }
        me._strategyRegistry.set(dropZoneType, strategyInstance);
    }

    /**
     * Removes a strategy from the registry.
     * @param {string} dropZoneType - The identifier (e.g., 'column').
     * @returns {void}
     */
    unregisterStrategy(dropZoneType) {
        this._strategyRegistry.delete(dropZoneType);
    }

    /**
     * <DraggedData> getter.
     * @returns {{item: object | null, type: string | null, element: HTMLElement | null}}
     */
    getDraggedData() {
        return this._dragState;
    }

    /**
     * <Placeholder> getter.
     * @returns {HTMLElement} The shared placeholder DOM element.
     */
    getPlaceholder() {
        return this._placeholder;
    }

    /**
     * Checks if a drag operation is currently in progress.
     * @returns {boolean}
     */
    isDragging() {
        return this._isDragging;
    }

    /**
     * Cleans up all appBus listeners.
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);
    }

    /**
     * Creates the shared placeholder element.
     * @private
     * @returns {void}
     */
    _createPlaceholder() {
        this._placeholder = document.createElement('div');
        this._placeholder.classList.add('container__placeholder');
    }

    /**
     * Attaches listeners to the appBus and native DND events on the body.
     * @private
     * @returns {void}
     */
    _initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };
        appBus.on('dragstart', me._boundOnDragStart, options);
        appBus.on('dragend', me._boundOnDragEnd, options);

        const rootElement = document.body;
        rootElement.addEventListener('dragenter', me._onNativeDragEnter.bind(me));
        rootElement.addEventListener('dragover', me._onNativeDragOver.bind(me));
        rootElement.addEventListener('dragleave', me._onNativeDragLeave.bind(me));
        rootElement.addEventListener('drop', me._onNativeDrop.bind(me));
    }

    /**
     * Unified native 'dragenter' handler (DOM Bridge).
     * @param {DragEvent} e
     * @private
     * @returns {void}
     */
    _onNativeDragEnter(e) {
        const me = this;
        if (!me.isDragging()) return;

        const dropZoneElement = e.target.closest('[data-dropzone]');
        if (!dropZoneElement || !dropZoneElement.dropZoneInstance) {
            return;
        }

        const dropZoneInstance = dropZoneElement.dropZoneInstance;
        const strategy = me._strategyRegistry.get(dropZoneInstance.dropZoneType);

        if (strategy && typeof strategy.handleDragEnter === 'function') {
            e.preventDefault();
            e.stopPropagation();
            strategy.handleDragEnter(e, dropZoneInstance, me.getDraggedData(), me);
        }
    }

    /**
     * Unified native 'dragover' handler (DOM Bridge).
     * @param {DragEvent} e
     * @private
     * @returns {void}
     */
    _onNativeDragOver(e) {
        const me = this;
        if (!me.isDragging()) return;

        const dropZoneElement = e.target.closest('[data-dropzone]');
        if (!dropZoneElement || !dropZoneElement.dropZoneInstance) {
            me.hidePlaceholder();
            return;
        }

        const dropZoneInstance = dropZoneElement.dropZoneInstance;
        const strategy = me._strategyRegistry.get(dropZoneInstance.dropZoneType);

        if (strategy && typeof strategy.handleDragOver === 'function') {
            e.preventDefault();
            e.stopPropagation();
            strategy.handleDragOver(e, dropZoneInstance, me.getDraggedData(), me);
        } else {
            me.hidePlaceholder();
        }
    }

    /**
     * Unified native 'dragleave' handler (DOM Bridge).
     * @param {DragEvent} e
     * @private
     * @returns {void}
     */
    _onNativeDragLeave(e) {
        const me = this;
        if (!me.isDragging()) return;

        const dropZoneElement = e.target.closest('[data-dropzone]');
        if (!dropZoneElement || !dropZoneElement.dropZoneInstance) {
            return;
        }

        const dropZoneInstance = dropZoneElement.dropZoneInstance;
        const strategy = me._strategyRegistry.get(dropZoneInstance.dropZoneType);

        if (strategy && typeof strategy.handleDragLeave === 'function') {
            e.preventDefault();
            e.stopPropagation();
            strategy.handleDragLeave(e, dropZoneInstance, me.getDraggedData(), me);
        }
    }

    /**
     * Unified native 'drop' handler (DOM Bridge).
     * @param {DragEvent} e
     * @private
     * @returns {void}
     */
    _onNativeDrop(e) {
        const me = this;
        if (!me.isDragging()) return;

        e.preventDefault();
        e.stopPropagation();

        const dropZoneElement = e.target.closest('[data-dropzone]');
        const placeholderVisible = !!me._placeholder.parentElement;
        const isTabContainerDrop =
            dropZoneElement && dropZoneElement.dropZoneInstance?.dropZoneType === 'TabContainer';

        if ((placeholderVisible || isTabContainerDrop) && dropZoneElement) {
            const dropZoneInstance = dropZoneElement.dropZoneInstance;
            const strategy = me._strategyRegistry.get(dropZoneInstance.dropZoneType);

            if (strategy && typeof strategy.handleDrop === 'function') {
                strategy.handleDrop(e, dropZoneInstance, me.getDraggedData(), me);
            } else {
                me.hidePlaceholder();
            }
        } else {
            const fpms = FloatingPanelManagerService.getInstance();
            fpms.handleUndockDrop(me.getDraggedData(), e);
            me.hidePlaceholder();
        }
    }

    /**
     * Clears the cache of all registered strategies.
     * @private
     * @returns {void}
     */
    _clearStrategyCaches() {
        const me = this;
        if (!me._strategyRegistry) return;
        for (const strategy of me._strategyRegistry.values()) {
            if (strategy && typeof strategy.clearCache === 'function') {
                strategy.clearCache();
            }
        }
    }

    /**
     * Handles the 'dragstart' event from the appBus.
     * @param {object} payload - { item, type, element, event }.
     * @private
     * @returns {void}
     */
    _onDragStart(payload) {
        const me = this;
        if (!payload || !payload.item || !payload.element) return;

        document.body.classList.add('dnd-active');
        me._clearStrategyCaches();

        const { item, type, element, event: e } = payload;

        me._dragState.item = item;
        me._dragState.type = type || null;
        me._dragState.element = element;
        me._isDragging = true;

        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.dropEffect = 'move';
        element.classList.add('dragging');

        const rect = element.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setDragImage(element, offsetX, offsetY);
    }

    /**
     * Handles the 'dragend' event from the appBus.
     * @private
     * @returns {void}
     */
    _onDragEnd() {
        const me = this;

        document.body.classList.remove('dnd-active');
        me.hidePlaceholder();
        me._clearStrategyCaches();

        if (me._dragState.element) {
            me._dragState.element.classList.remove('dragging');
        }

        me._dragState.item = null;
        me._dragState.type = null;
        me._dragState.element = null;
        me._isDragging = false;
    }
}
