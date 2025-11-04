import { appBus } from '../EventBus.js';

/**
 * Description:
 * Manages the global state for drag-and-drop (D&D) operations across the
 * application. It listens to appBus events ('dragstart', 'dragend') and
 * holds the state of the dragged item and the shared placeholder element.
 *
 * This is implemented as a Singleton.
 *
 * Properties summary:
 * - _draggedItem {PanelGroup | null} : The actual PanelGroup instance being dragged.
 * - _placeholder {HTMLElement} : The shared DOM element used to show drop locations.
 * - _isDragging {boolean} : Flag indicating if a D&D operation is active.
 *
 * Typical usage:
 * // In App.js (to initialize):
 * DragDropService.getInstance();
 *
 * // In components (to get state):
 * const dds = DragDropService.getInstance();
 * const item = dds.getDraggedItem();
 */
export class DragDropService {
    /**
     * @type {DragDropService | null}
     * @private
     */
    static _instance = null;

    /**
     * @type {import('../Panel/PanelGroup.js').PanelGroup | null}
     * @private
     */
    _draggedItem = null;

    /**
     * @type {HTMLElement}
     * @private
     */
    _placeholder = null;

    /**
     * @type {boolean}
     * @private
     */
    _isDragging = false;

    /**
     * Private constructor for Singleton pattern.
     * @private
     */
    constructor() {
        if (DragDropService._instance) {
            console.warn('DragDropService instance already exists. Use getInstance().');
            return DragDropService._instance;
        }
        DragDropService._instance = this;

        this._createPlaceholder();
        this._initEventListeners();
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
     * Returns the PanelGroup instance currently being dragged.
     * @returns {import('../Panel/PanelGroup.js').PanelGroup | null}
     */
    getDraggedItem() {
        return this._draggedItem;
    }

    /**
     * Returns the shared placeholder DOM element.
     * @returns {HTMLElement}
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
     * Creates the placeholder element based on the BEM class.
     * @private
     */
    _createPlaceholder() {
        this._placeholder = document.createElement('div');
        this._placeholder.classList.add('container__placeholder');
    }

    /**
     * Subscribes to the global appBus D&D events.
     * @private
     */
    _initEventListeners() {
        appBus.on('dragstart', this._onDragStart.bind(this));
        appBus.on('dragend', this._onDragEnd.bind(this));
    }

    /**
     * Handles the 'dragstart' event from the appBus.
     * (Lógica movida de Container.js: startDrag)
     * @param {object} payload - The event payload { item: PanelGroup, event: DragEvent }.
     * @private
     */
    _onDragStart(payload) {
        if (!payload || !payload.item) return;

        const item = payload.item;
        const e = payload.event;

        this._draggedItem = item;
        this._isDragging = true;

        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.dropEffect = 'move';
        item.element.classList.add('dragging');
        this._placeholder.style.height = `${item.element.offsetHeight}px`;
        e.dataTransfer.setDragImage(item.element, 20, 20);
    }

    /**
     * Handles the 'dragend' event from the appBus.
     * (Lógica movida de Container.js: endDrag)
     * @private
     */
    _onDragEnd() {
        if (this._placeholder.parentElement) {
            this._placeholder.parentElement.removeChild(this._placeholder);
        }

        if (this._draggedItem && this._draggedItem.element) {
            this._draggedItem.element.classList.remove('dragging');
        }

        this._draggedItem = null;
        this._isDragging = false;
    }
}
