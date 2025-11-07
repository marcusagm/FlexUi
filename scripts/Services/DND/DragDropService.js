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
 * This is implemented as a Singleton.
 */
export class DragDropService {
    /**
     * @type {DragDropService | null}
     * @private
     */
    static _instance = null;

    /**
     * @type {object | null}
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
     * (NOVO) Esconde o placeholder, removendo-o do DOM e redefinindo
     * as suas classes de modo (horizontal/vertical).
     */
    hidePlaceholder() {
        if (this._placeholder.parentElement) {
            this._placeholder.parentElement.removeChild(this._placeholder);
        }
        // Redefine para o estado base, removendo classes de modo
        this._placeholder.className = 'container__placeholder';
        // Redefine a altura que pode ter sido definida via JS (modo horizontal)
        this._placeholder.style.height = '';
    }

    /**
     * (NOVO) Prepara o placeholder para ser exibido num modo.
     * As estratégias são responsáveis por o inserir no DOM.
     * @param {'horizontal' | 'vertical'} mode - O modo de exibição.
     * @param {number | null} [height=null] - A altura (usada apenas no modo horizontal).
     */
    showPlaceholder(mode, height = null) {
        // 1. Garante que está limpo de estados anteriores
        this.hidePlaceholder();

        // 2. Aplica o modo
        if (mode === 'horizontal') {
            this._placeholder.classList.add('container__placeholder--horizontal');
            if (height) {
                this._placeholder.style.height = `${height}px`;
            }
        } else if (mode === 'vertical') {
            this._placeholder.classList.add('container__placeholder--vertical');
            // A altura/largura é controlada pelo CSS no modo vertical
        }
    }

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
     * @returns {object | null}
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
     * (NOVO) Delega a lógica de 'dragenter' para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {object} dropZone - The drop zone instance (this).
     */
    handleDragEnter(e, dropZone) {
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && typeof strategy.handleDragEnter === 'function') {
            // (MODIFICADO) Passa a instância do DDS para a estratégia
            strategy.handleDragEnter(e, dropZone, this._draggedItem, this);
        }
    }

    /**
     * (REFATORADO) Delega a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {object} dropZone - The drop zone instance (this).
     */
    handleDragOver(e, dropZone) {
        const draggedItem = this.getDraggedItem();
        if (!draggedItem) return;

        // 1. Lógica comum: (REMOVIDO - Agora é responsabilidade das estratégias)
        // this.getPlaceholder().remove();

        // 2. Delegar para a estratégia específica
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && typeof strategy.handleDragOver === 'function') {
            // (MODIFICADO) Passa a instância do DDS para a estratégia
            strategy.handleDragOver(e, dropZone, this._draggedItem, this);
        }
    }

    /**
     * (MODIFICADO) Delega a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {Column | ColumnCreateArea} dropZone - The drop zone instance (this).
     */
    handleDragLeave(e, dropZone) {
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && typeof strategy.handleDragLeave === 'function') {
            // (MODIFICADO) Passa a instância do DDS para a estratégia
            strategy.handleDragLeave(e, dropZone, this._draggedItem, this);
        }
    }

    /**
     * (REFATORADO) Delega a lógica para a estratégia registrada.
     * @param {DragEvent} e - The native drag event.
     * @param {Column | ColumnCreateArea} dropZone - The drop zone instance (this).
     */
    handleDrop(e, dropZone) {
        const strategy = this._strategyRegistry.get(dropZone.dropZoneType);
        if (strategy && typeof strategy.handleDrop === 'function') {
            // (MODIFICADO) Passa a instância do DDS para a estratégia
            strategy.handleDrop(e, dropZone, this._draggedItem, this);
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
     * (NOVO - CORREÇÃO) Itera sobre todas as estratégias registradas e limpa
     * os seus caches internos (estado).
     * @private
     */
    _clearStrategyCaches() {
        if (!this._strategyRegistry) return;

        for (const strategy of this._strategyRegistry.values()) {
            if (strategy && typeof strategy.clearCache === 'function') {
                strategy.clearCache();
            }
        }
    }

    /**
     * Handles the 'dragstart' event from the appBus.
     * @param {object} payload - The event payload { item: PanelGroup, event: DragEvent }.
     * @private
     */
    _onDragStart(payload) {
        if (!payload || !payload.item) return;

        // (ADIÇÃO DA CORREÇÃO) Limpa caches de estratégias anteriores
        this._clearStrategyCaches();

        const item = payload.item;
        const e = payload.event;

        // 1. Definir Estado
        this._draggedItem = item;
        this._isDragging = true;

        // 2. Aplicar lógica de D&D
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.dropEffect = 'move';
        item.element.classList.add('dragging');
        e.dataTransfer.setDragImage(item.element, 20, 20);
    }

    /**
     * Handles the 'dragend' event from the appBus.
     * @private
     */
    _onDragEnd() {
        // (MODIFICADO) Usa o novo método centralizado
        this.hidePlaceholder();

        // (ADIÇÃO DA CORREÇÃO) Limpa os caches de D&D
        this._clearStrategyCaches();

        // 2. Remover feedback visual
        if (this._draggedItem && this._draggedItem.element) {
            this._draggedItem.element.classList.remove('dragging');
        }

        // 3. Resetar Estado
        this._draggedItem = null;
        this._isDragging = false;
    }
}
