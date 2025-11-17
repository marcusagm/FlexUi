import { appBus } from '../../utils/EventBus.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { Panel } from '../../components/Panel/Panel.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { ToolbarContainerDropStrategy } from './ToolbarContainerDropStrategy.js';

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
 * - _draggedSourceElement {HTMLElement|null} : The dropzone element being dragged.
 * - _draggedSourceDropzone {string|null} : The original 'data-dropzone' value.
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
 * Business rules implemented:
 * - Uses a "clean clone" method for non-floating drag ghosts
 * to prevent visual artifacts from overlapping UI elements.
 * - Calls preventDefault() universally on dragOver if dragging is active
 * to allow floating panels to move over non-dropzone areas.
 *
 * Dependencies:
 * - utils/EventBus.js
 * - components/Panel/Panel.js
 * - components/Panel/PanelGroup.js
 * - utils/ThrottleRAF.js
 * - ./ToolbarContainerDropStrategy.js
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
     * @type {{
     * item: object | null,
     * type: string | null,
     * element: HTMLElement | null,
     * offsetX: number,
     * offsetY: number
     * }}
     * @private
     */
    _dragState = { item: null, type: null, element: null, offsetX: 0, offsetY: 0 };

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
     * A 1x1 transparent Image object, pre-cached for use as a drag ghost.
     * @type {Image | null}
     * @private
     */
    _transparentDragImage = null;

    /**
     * Throttled function to update floating panel position during drag.
     * @type {Function | null}
     * @private
     */
    _throttledMoveFloatingPanel = null;

    /**
     * Stores the temporary cloned element used for a clean drag ghost image.
     * @type {HTMLElement | null}
     * @private
     */
    _dragGhostClone = null;

    /**
     * Caches the last valid X coordinate from dragOver.
     * @type {number}
     * @private
     */
    _lastDragX = 0;

    /**
     * Caches the last valid Y coordinate from dragOver.
     * @type {number}
     * @private
     */
    _lastDragY = 0;

    /**
     * Stores the dropzone element being dragged to temporarily disable it.
     * @type {HTMLElement | null}
     * @private
     */
    _draggedSourceElement = null;

    /**
     * Stores the original 'data-dropzone' value of the element being dragged.
     * @type {string | null}
     * @private
     */
    _draggedSourceDropzone = null;

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
        me._createTransparentDragImage();

        me._boundOnDragStart = me._onDragStart.bind(me);
        me._boundOnDragEnd = me._onDragEnd.bind(me);
        me._throttledMoveFloatingPanel = throttleRAF(me._moveFloatingPanel.bind(me));

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
     * @returns {{
     * item: object | null,
     * type: string | null,
     * element: HTMLElement | null,
     * offsetX: number,
     * offsetY: number
     * }}
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
        me._throttledMoveFloatingPanel?.cancel();
        me._throttledMoveFloatingPanel = null;
        me._transparentDragImage = null;

        if (me._dragGhostClone) {
            me._dragGhostClone.remove();
            me._dragGhostClone = null;
        }
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
     * Creates and caches the 1x1 transparent drag image to prevent race conditions.
     * @private
     * @returns {void}
     */
    _createTransparentDragImage() {
        const me = this;
        const transparentPixelBase64 =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

        me._transparentDragImage = new Image(1, 1);
        me._transparentDragImage.src = transparentPixelBase64;
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

        const dropZoneElement = e.target.closest(
            "[data-dropzone='column'], [data-dropzone='row'], [data-dropzone='container'], [data-dropzone='TabContainer'], [data-dropzone='toolbar-container']"
        );
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

        // CORREÇÃO: Chamada universal de preventDefault para permitir
        // o arraste sobre áreas não-dropzone (ex: menu, painel flutuante).
        e.preventDefault();
        e.stopPropagation();

        if (e.clientX !== 0 || e.clientY !== 0) {
            me._lastDragX = e.clientX;
            me._lastDragY = e.clientY;
        }

        if (me._dragState.type === 'PanelGroup' && me._dragState.item._state.isFloating === true) {
            me._throttledMoveFloatingPanel();
        }

        const dropZoneElement = e.target.closest(
            "[data-dropzone='column'], [data-dropzone='row'], [data-dropzone='container'], [data-dropzone='TabContainer'], [data-dropzone='toolbar-container']"
        );
        if (!dropZoneElement || !dropZoneElement.dropZoneInstance) {
            me.hidePlaceholder();
            return;
        }

        const dropZoneInstance = dropZoneElement.dropZoneInstance;
        const strategy = me._strategyRegistry.get(dropZoneInstance.dropZoneType);

        if (strategy && typeof strategy.handleDragOver === 'function') {
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

        const dropZoneElement = e.target.closest(
            "[data-dropzone='column'], [data-dropzone='row'], [data-dropzone='container'], [data-dropzone='TabContainer'], [data-dropzone='toolbar-container']"
        );
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

        const dropZoneElement = e.target.closest(
            "[data-dropzone='column'], [data-dropzone='row'], [data-dropzone='container'], [data-dropzone='TabContainer'], [data-dropzone='toolbar-container']"
        );
        const placeholderVisible = !!me._placeholder.parentElement;

        const dropZoneInstance = dropZoneElement ? dropZoneElement.dropZoneInstance : null;
        const isTabContainerDrop =
            dropZoneInstance && dropZoneInstance.dropZoneType === 'TabContainer';
        const isToolbarContainerDrop =
            dropZoneInstance && dropZoneInstance.dropZoneType === 'toolbar-container';

        if (
            (placeholderVisible || isTabContainerDrop || isToolbarContainerDrop) &&
            dropZoneElement
        ) {
            const dropZoneInstance = dropZoneElement.dropZoneInstance;
            const strategy = me._strategyRegistry.get(dropZoneInstance.dropZoneType);

            if (strategy && typeof strategy.handleDrop === 'function') {
                strategy.handleDrop(e, dropZoneInstance, me.getDraggedData(), me);
            } else {
                me.hidePlaceholder();
            }
        } else {
            const fpms = FloatingPanelManagerService.getInstance();
            fpms.handleUndockDrop(me.getDraggedData(), me._lastDragX, me._lastDragY);
            me.hidePlaceholder();
        }
    }

    /**
     * Helper method (called via throttle) to update the visual position
     * of a floating panel during a drag.
     * @private
     * @returns {void}
     */
    _moveFloatingPanel() {
        const me = this;
        if (
            !me.isDragging() ||
            me._dragState.type !== 'PanelGroup' ||
            !me._dragState.item._state.isFloating
        ) {
            return;
        }

        const fpms = FloatingPanelManagerService.getInstance();
        const containerRect = fpms.getContainerBounds();
        if (containerRect) {
            const newX = me._lastDragX - containerRect.left - me._dragState.offsetX;
            const newY = me._lastDragY - containerRect.top - me._dragState.offsetY;
            fpms.updatePanelPosition(me._dragState.item, newX, newY);
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
     * @param {object} payload - { item, type, element, event, offsetX, offsetY }.
     * @private
     * @returns {void}
     */
    _onDragStart(payload) {
        const me = this;
        if (!payload || !payload.item || !payload.element) return;

        document.body.classList.add('dnd-active');

        if (payload.type && typeof payload.type === 'string') {
            const typeClass = `dnd-type-${payload.type.toLowerCase()}`;
            document.body.classList.add(typeClass);
        }

        me._clearStrategyCaches();

        const { item, type, element, event, offsetX, offsetY } = payload;

        me._dragState.item = item;
        me._dragState.type = type || null;
        me._dragState.element = element;
        me._dragState.offsetX = offsetX || 0;
        me._dragState.offsetY = offsetY || 0;
        me._isDragging = true;

        element.classList.add('dragging');

        let relevantGroup = null;
        if (type === 'PanelGroup' && item instanceof PanelGroup) {
            relevantGroup = item;
        }

        if (relevantGroup && relevantGroup._state.header) {
            const sourceDropZone = relevantGroup._state.header.element;
            if (sourceDropZone && sourceDropZone.dataset.dropzone) {
                me._draggedSourceElement = sourceDropZone;
                me._draggedSourceDropzone = sourceDropZone.dataset.dropzone;
                sourceDropZone.dataset.dropzone = 'false';
            }
        }

        event.dataTransfer.dropEffect = 'move';
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', '');

        if (me._dragState.item._state.isFloating === true) {
            const dragImage = me._transparentDragImage;
            event.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
        } else {
            const clone = element.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '0';
            clone.style.width = `${element.offsetWidth}px`;
            document.body.appendChild(clone);
            me._dragGhostClone = clone;

            event.dataTransfer.setDragImage(clone, offsetX, offsetY);
        }
    }

    /**
     * Handles the 'dragend' event from the appBus.
     * @private
     * @returns {void}
     */
    _onDragEnd() {
        const me = this;

        if (me._dragGhostClone) {
            me._dragGhostClone.remove();
            me._dragGhostClone = null;
        }

        me._throttledMoveFloatingPanel?.cancel();
        document.body.classList.remove('dnd-active');

        const classesToRemove = [];
        document.body.classList.forEach(cls => {
            if (cls.startsWith('dnd-type-')) {
                classesToRemove.push(cls);
            }
        });
        classesToRemove.forEach(cls => document.body.classList.remove(cls));

        me.hidePlaceholder();
        me._clearStrategyCaches();

        if (me._draggedSourceElement) {
            me._draggedSourceElement.dataset.dropzone = me._draggedSourceDropzone;
            me._draggedSourceElement = null;
            me._draggedSourceDropzone = null;
        }

        if (me._dragState.element) {
            me._dragState.element.classList.remove('dragging');
        }

        me._dragState.item = null;
        me._dragState.type = null;
        me._dragState.element = null;
        me._dragState.offsetX = 0;
        me._dragState.offsetY = 0;
        me._isDragging = false;
        me._lastDragX = 0;
        me._lastDragY = 0;
    }
}
