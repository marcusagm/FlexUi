import { appBus } from '../../EventBus.js';

/**
 * Description:
 * Manages the global state and logic for drag-and-drop (D&D) operations.
 *
 * (Refatorado vPlan) Agora gere um *único* placeholder (this._placeholder)
 * e expõe métodos (show/hidePlaceholder) para que as Estratégias
 * controlem a sua aparência (horizontal vs. vertical).
 *
 * (Refatorado vBugFix) Agora é responsável por limpar o cache
 * de todas as estratégias registadas no início e fim do D&D.
 *
 * (Refatorado vFeature) Agora é generalizado. Rastreia não apenas
 * o 'item' arrastado, mas também o 'type' (PanelGroup vs. Panel).
 *
 * This is implemented as a Singleton.
 */
export class DragDropService {
    /**
     * @type {DragDropService | null}
     * @private
     */
    static _instance = null;

    /**
     * (MODIFICADO) Armazena o item E o seu tipo.
     * @type {{item: object | null, type: string | null}}
     * @private
     */
    _draggedData = { item: null, type: null };

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
     * Registro para o Strategy Pattern.
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
     * Esconde o placeholder, removendo-o do DOM e redefinindo
     * as suas classes de modo (horizontal/vertical).
     */
    hidePlaceholder() {
        if (this._placeholder.parentElement) {
            this._placeholder.parentElement.removeChild(this._placeholder);
        }
        this._placeholder.className = 'container__placeholder';
        this._placeholder.style.height = '';
    }

    /**
     * Prepara o placeholder para ser exibido num modo.
     * @param {'horizontal' | 'vertical'} mode - O modo de exibição.
     * @param {number | null} [height=null] - A altura (usada apenas no modo horizontal).
     */
    showPlaceholder(mode, height = null) {
        this.hidePlaceholder();
        if (mode === 'horizontal') {
            this._placeholder.classList.add('container__placeholder--horizontal');
            if (height) {
                this._placeholder.style.height = `${height}px`;
            }
        } else if (mode === 'vertical') {
            this._placeholder.classList.add('container__placeholder--vertical');
        }
    }

    /**
     * Registra uma estratégia de D&D para um tipo de zona de soltura.
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
     * Remove o registro de uma estratégia.
     * @param {string} dropZoneType - O identificador (ex: 'column').
     */
    unregisterStrategy(dropZoneType) {
        this._strategyRegistry.delete(dropZoneType);
    }

    /**
     * (MODIFICADO) Returns o objeto de dados (item e tipo).
     * @returns {{item: object | null, type: string | null}}
     */
    getDraggedData() {
        return this._draggedData;
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
     * (MODIFICADO) Delega a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {object} dropZone - The drop zone instance (this).
     */
    handleDragEnter(e, dropZone) {
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && typeof strategy.handleDragEnter === 'function') {
            // Passa o objeto _draggedData completo
            strategy.handleDragEnter(e, dropZone, this._draggedData, this);
        }
    }

    /**
     * (MODIFICADO) Delega a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {object} dropZone - The drop zone instance (this).
     */
    handleDragOver(e, dropZone) {
        const draggedData = this.getDraggedData();
        if (!draggedData.item) return;

        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && typeof strategy.handleDragOver === 'function') {
            // Passa o objeto _draggedData completo
            strategy.handleDragOver(e, dropZone, draggedData, this);
        }
    }

    /**
     * (MODIFICADO) Delega a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {object} dropZone - The drop zone instance (this).
     */
    handleDragLeave(e, dropZone) {
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && typeof strategy.handleDragLeave === 'function') {
            // Passa o objeto _draggedData completo
            strategy.handleDragLeave(e, dropZone, this._draggedData, this);
        }
    }

    /**
     * (MODIFICADO) Delega a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {object} dropZone - The drop zone instance (this).
     */
    handleDrop(e, dropZone) {
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && typeof strategy.handleDrop === 'function') {
            // Passa o objeto _draggedData completo
            strategy.handleDrop(e, dropZone, this._draggedData, this);
        }
    }

    // --- Métodos Privados ---

    _createPlaceholder() {
        this._placeholder = document.createElement('div');
        this._placeholder.classList.add('container__placeholder');
    }

    _initEventListeners() {
        appBus.on('dragstart', this._onDragStart.bind(this));
        appBus.on('dragend', this._onDragEnd.bind(this));
    }

    _clearStrategyCaches() {
        if (!this._strategyRegistry) return;
        for (const strategy of this._strategyRegistry.values()) {
            if (strategy && typeof strategy.clearCache === 'function') {
                strategy.clearCache();
            }
        }
    }

    /**
     * (MODIFICADO) Handles o 'dragstart' e armazena o TIPO.
     * @param {object} payload - { item: Panel|PanelGroup, type: string, event: DragEvent }.
     * @private
     */
    _onDragStart(payload) {
        if (!payload || !payload.item) return;

        this._clearStrategyCaches();

        const { item, type, event: e } = payload;

        // 1. Definir Estado
        this._draggedData.item = item;
        this._draggedData.type = type || null; // Armazena o tipo
        this._isDragging = true;

        // 2. Aplicar lógica de D&D
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.dropEffect = 'move';
        item.element.classList.add('dragging');
        e.dataTransfer.setDragImage(item.element, 20, 20);
    }

    /**
     * (MODIFICADO) Handles o 'dragend' e limpa o objeto _draggedData.
     * @private
     */
    _onDragEnd() {
        this.hidePlaceholder();
        this._clearStrategyCaches();

        // Remover feedback visual
        if (this._draggedData.item && this._draggedData.item.element) {
            this._draggedData.item.element.classList.remove('dragging');
        }

        // Resetar Estado
        this._draggedData.item = null;
        this._draggedData.type = null;
        this._isDragging = false;
    }
}
