import { appBus } from '../EventBus.js';
import { PanelGroup } from '../Panel/PanelGroup.js';

/**
 * Description:
 * Manages the global state and logic for drag-and-drop (D&D) operations.
 * It listens to appBus events, holds the dragged item state, and now also
 * contains the logic for handling drop targets (Drop Zones).
 *
 * This is implemented as a Singleton.
 *
 * Properties summary:
 * - _draggedItem {PanelGroup | null} : The actual PanelGroup instance being dragged.
 * - _placeholder {HTMLElement} : The shared DOM element used to show drop locations.
 * - _isDragging {boolean} : Flag indicating if a D&D operation is active.
 * - _strategyRegistry {Map} : (NOVO) Armazena as estratégias de soltura (Strategy Pattern).
 *
 * Typical usage:
 * // In App.js (to initialize):
 * const dds = DragDropService.getInstance();
 * dds.registerStrategy('column', new ColumnDropStrategy(dds));
 * dds.registerStrategy('create-area', new CreateAreaDropStrategy(dds));
 *
 * // In Drop Zones (e.g., Column.js):
 * onDragOver(e) {
 * e.preventDefault();
 * DragDropService.getInstance().handleDragOver(e, this); // 'this' is the dropZone
 * }
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
     * (NOVO) Registro para o Strategy Pattern.
     * @type {Map<string, object>}
     * @private
     */
    _strategyRegistry = new Map();

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

    // --- API Pública ---

    /**
     * (NOVO) Registra uma estratégia de D&D para um tipo de zona de soltura.
     * (Injeção de Dependência)
     * @param {string} dropZoneType - O identificador (ex: 'column').
     * @param {object} strategyInstance - A instância da classe de estratégia.
     */
    registerStrategy(dropZoneType, strategyInstance) {
        if (!dropZoneType) {
            console.warn('DragDropService: Tentativa de registrar estratégia sem dropZoneType.');
            return;
        }
        if (
            !strategyInstance ||
            (typeof strategyInstance.handleDrop !== 'function' &&
                typeof strategyInstance.handleDragOver !== 'function')
        ) {
            console.warn(`DragDropService: Estratégia inválida para "${dropZoneType}".`);
            return;
        }
        this._strategyRegistry.set(dropZoneType, strategyInstance);
    }

    /**
     * (NOVO) Remove o registro de uma estratégia.
     * @param {string} dropZoneType - O identificador (ex: 'column').
     */
    unregisterStrategy(dropZoneType) {
        this._strategyRegistry.delete(dropZoneType);
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
     * (REFATORADO) Deleta a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {Column | ColumnCreateArea} dropZone - The drop zone instance (this).
     */
    handleDragOver(e, dropZone) {
        const draggedItem = this.getDraggedItem();
        if (!draggedItem) return;

        // 1. Lógica comum: remover placeholder de qualquer outro lugar
        // (Movido para cá, pois ColumnCreateArea também precisa disso)
        this.getPlaceholder().remove();

        // 2. Delegar para a estratégia específica
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && strategy.handleDragOver) {
            strategy.handleDragOver(e, dropZone, this._draggedItem, this._placeholder);
        }
    }

    /**
     * (REFATORADO) Deleta a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {Column | ColumnCreateArea} dropZone - The drop zone instance (this).
     */
    handleDragLeave(e, dropZone) {
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && strategy.handleDragLeave) {
            strategy.handleDragLeave(e, dropZone, this._draggedItem, this._placeholder);
        }
    }

    /**
     * (REFATORADO) Deleta a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {Column | ColumnCreateArea} dropZone - The drop zone instance (this).
     */
    handleDrop(e, dropZone) {
        const draggedItem = this.getDraggedItem();
        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }

        // Delegar para a estratégia específica
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && strategy.handleDrop) {
            strategy.handleDrop(e, dropZone, this._draggedItem, this._placeholder);
        }
    }

    // --- Métodos Privados ---

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
     * @param {object} payload - The event payload { item: PanelGroup, event: DragEvent }.
     * @private
     */
    _onDragStart(payload) {
        if (!payload || !payload.item) return;

        const item = payload.item;
        const e = payload.event;

        // 1. Definir Estado
        this._draggedItem = item;
        this._isDragging = true;

        // 2. Aplicar lógica de D&D (copiado de Container.startDrag)
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.dropEffect = 'move';
        item.element.classList.add('dragging');
        this._placeholder.style.height = `${item.element.offsetHeight}px`;
        e.dataTransfer.setDragImage(item.element, 20, 20);
    }

    /**
     * Handles the 'dragend' event from the appBus.
     * @private
     */
    _onDragEnd() {
        // 1. Remover placeholder do DOM
        if (this._placeholder.parentElement) {
            this._placeholder.parentElement.removeChild(this._placeholder);
        }

        // 2. Remover feedback visual
        if (this._draggedItem && this._draggedItem.element) {
            this._draggedItem.element.classList.remove('dragging');
        }

        // 3. Resetar Estado
        this._draggedItem = null;
        this._isDragging = false;
    }
}

