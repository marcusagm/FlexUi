import { appBus } from '../../utils/EventBus.js';

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
 * (Refatorado vBugFix 2) Agora armazena o 'element' explícito
 * no payload 'dragstart' para evitar aceder a 'item.element' (que
 * é 'undefined' para a classe Panel).
 *
 * (Refatorado vOpt 4) Agora armazena o _placeholderMode para
 * evitar escritas redundantes no DOM durante o 'dragover'.
 *
 * (REFATORADO vDND-Bridge) Esta classe agora anexa 4 listeners DND globais
 * ao document.body e usa 'event delegation' para encontrar a 'dropZoneInstance'
 * e chamar a Strategy apropriada.
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
     * (MODIFICADO) Armazena item, tipo E o elemento DOM.
     * @type {{item: object | null, type: string | null, element: HTMLElement | null}}
     * @private
     */
    _draggedData = { item: null, type: null, element: null };

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
     * (NOVO - Otimização 4) Armazena o modo atual do placeholder
     * para evitar escritas desnecessárias no DOM.
     * @type {'horizontal' | 'vertical' | null}
     * @private
     */
    _placeholderMode = null;

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
     * (MODIFICADO - Otimização 4)
     * Esconde o placeholder, removendo-o do DOM e redefinindo
     * as suas classes de modo (horizontal/vertical) e o cache de modo.
     */
    hidePlaceholder() {
        if (this._placeholder.parentElement) {
            this._placeholder.parentElement.removeChild(this._placeholder);
        }
        // Redefine para o estado base, removendo classes de modo
        this._placeholder.className = 'container__placeholder';
        // Redefine a altura que pode ter sido definida via JS (modo horizontal)
        this._placeholder.style.height = '';
        // (MODIFICADO) Reseta o cache de modo
        this._placeholderMode = null;
    }

    /**
     * (MODIFICADO - Otimização 4)
     * Prepara o placeholder para ser exibido num modo.
     * Evita reescrever o DOM se o modo já estiver correto.
     *
     * @param {'horizontal' | 'vertical'} mode - O modo de exibição.
     * @param {number | null} [height=null] - A altura (usada apenas no modo horizontal).
     */
    showPlaceholder(mode, height = null) {
        // (MODIFICADO) Otimização: Verifica se o modo já está aplicado
        if (mode === this._placeholderMode) {
            // Se o modo (horizontal) for o mesmo, apenas atualiza a altura se necessário
            if (
                mode === 'horizontal' &&
                height &&
                this._placeholder.style.height !== `${height}px`
            ) {
                this._placeholder.style.height = `${height}px`;
            }
            return; // Evita reescrever o className
        }

        // Se o modo for novo, redefine (hide) e aplica o novo modo
        this.hidePlaceholder(); // hidePlaceholder agora define _placeholderMode = null

        if (mode === 'horizontal') {
            this._placeholder.classList.add('container__placeholder--horizontal');
            if (height) {
                this._placeholder.style.height = `${height}px`;
            }
        } else if (mode === 'vertical') {
            this._placeholder.classList.add('container__placeholder--vertical');
        }

        // (MODIFICADO) Armazena o novo modo
        this._placeholderMode = mode;
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
     * (MODIFICADO) Returns o objeto de dados (item, tipo, elemento).
     * @returns {{item: object | null, type: string | null, element: HTMLElement | null}}
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

    // (INÍCIO DA MODIFICAÇÃO - Etapa 5)
    // (REMOVIDO) Métodos handleDragEnter, handleDragOver, handleDragLeave, handleDrop
    // (FIM DA MODIFICAÇÃO)

    // --- Métodos Privados ---

    _createPlaceholder() {
        this._placeholder = document.createElement('div');
        this._placeholder.classList.add('container__placeholder');
    }

    /**
     * (MODIFICADO - Etapa 5) Anexa listeners ao appBus e os listeners DND
     * unificados ao document.body.
     */
    _initEventListeners() {
        appBus.on('dragstart', this._onDragStart.bind(this));
        appBus.on('dragend', this._onDragEnd.bind(this));

        // (INÍCIO DA MODIFICAÇÃO - Etapa 5)
        // Anexa os listeners unificados ao body
        const rootElement = document.body;
        rootElement.addEventListener('dragenter', this._onNativeDragEnter.bind(this));
        rootElement.addEventListener('dragover', this._onNativeDragOver.bind(this));
        rootElement.addEventListener('dragleave', this._onNativeDragLeave.bind(this));
        rootElement.addEventListener('drop', this._onNativeDrop.bind(this));
        // (FIM DA MODIFICAÇÃO)
    }

    // (INÍCIO DA MODIFICAÇÃO - Etapa 5)
    // --- Handlers Nativos Unificados (DOM Bridge) ---

    /**
     * (NOVO - Etapa 5) Handler unificado para 'dragenter'.
     * Encontra a dropzone e delega para a estratégia.
     * @param {DragEvent} e
     * @private
     */
    _onNativeDragEnter(e) {
        if (!this.isDragging()) return;

        const dropZoneElement = e.target.closest('[data-dropzone]');
        if (!dropZoneElement || !dropZoneElement.dropZoneInstance) {
            return;
        }

        const dropZoneInstance = dropZoneElement.dropZoneInstance;
        const strategy = this._strategyRegistry.get(dropZoneInstance.dropZoneType);

        if (strategy && typeof strategy.handleDragEnter === 'function') {
            e.preventDefault();
            e.stopPropagation();
            strategy.handleDragEnter(e, dropZoneInstance, this.getDraggedData(), this);
        }
    }

    /**
     * (NOVO - Etapa 5) Handler unificado para 'dragover'.
     * Encontra a dropzone e delega para a estratégia.
     * @param {DragEvent} e
     * @private
     */
    _onNativeDragOver(e) {
        if (!this.isDragging()) return;

        const dropZoneElement = e.target.closest('[data-dropzone]');
        if (!dropZoneElement || !dropZoneElement.dropZoneInstance) {
            this.hidePlaceholder(); // Oculta se estiver sobre uma área não-drop
            return;
        }

        const dropZoneInstance = dropZoneElement.dropZoneInstance;
        const strategy = this._strategyRegistry.get(dropZoneInstance.dropZoneType);
        // console.info(dropZoneInstance.dropZoneType);

        if (strategy && typeof strategy.handleDragOver === 'function') {
            e.preventDefault();
            e.stopPropagation();
            strategy.handleDragOver(e, dropZoneInstance, this.getDraggedData(), this);
        } else {
            this.hidePlaceholder(); // Oculta se a estratégia for inválida
        }
    }

    /**
     * (NOVO - Etapa 5) Handler unificado para 'dragleave'.
     * Encontra a dropzone e delega para a estratégia.
     * @param {DragEvent} e
     * @private
     */
    _onNativeDragLeave(e) {
        if (!this.isDragging()) return;

        // e.target é o elemento que o mouse acabou de sair
        const dropZoneElement = e.target.closest('[data-dropzone]');

        // Se saímos de um elemento que não é um dropzone (ou filho), ignora
        if (!dropZoneElement || !dropZoneElement.dropZoneInstance) {
            return;
        }

        const dropZoneInstance = dropZoneElement.dropZoneInstance;
        const strategy = this._strategyRegistry.get(dropZoneInstance.dropZoneType);

        if (strategy && typeof strategy.handleDragLeave === 'function') {
            e.preventDefault();
            e.stopPropagation();
            // A estratégia (ex: ColumnDropStrategy) fará a verificação do relatedTarget
            strategy.handleDragLeave(e, dropZoneInstance, this.getDraggedData(), this);
        }
    }

    /**
     * (NOVO - Etapa 5) Handler unificado para 'drop'.
     * Encontra a dropzone e delega para a estratégia.
     * @param {DragEvent} e
     * @private
     */
    _onNativeDrop(e) {
        if (!this.isDragging()) return;

        const dropZoneElement = e.target.closest('[data-dropzone]');
        if (!dropZoneElement || !dropZoneElement.dropZoneInstance) {
            this.hidePlaceholder(); // Garante que o placeholder suma
            return;
        }

        const dropZoneInstance = dropZoneElement.dropZoneInstance;
        const strategy = this._strategyRegistry.get(dropZoneInstance.dropZoneType);

        if (strategy && typeof strategy.handleDrop === 'function') {
            e.preventDefault();
            e.stopPropagation();
            strategy.handleDrop(e, dropZoneInstance, this.getDraggedData(), this);
        } else {
            this.hidePlaceholder(); // Garante que o placeholder suma
        }
    }
    // (FIM DA MODIFICAÇÃO)

    _clearStrategyCaches() {
        if (!this._strategyRegistry) return;
        for (const strategy of this._strategyRegistry.values()) {
            if (strategy && typeof strategy.clearCache === 'function') {
                strategy.clearCache();
            }
        }
    }

    /**
     * (MODIFICADO) Handles o 'dragstart' e armazena o TIPO e o ELEMENTO.
     * @param {object} payload - { item: Panel|PanelGroup, type: string, element: HTMLElement, event: DragEvent }.
     * @private
     */
    _onDragStart(payload) {
        // (MODIFICADO) Verifica também o 'element'
        if (!payload || !payload.item || !payload.element) return;

        this._clearStrategyCaches();

        // (MODIFICADO) Desestrutura o 'element'
        const { item, type, element, event: e } = payload;

        // 1. Definir Estado
        this._draggedData.item = item;
        this._draggedData.type = type || null;
        this._draggedData.element = element; // (NOVO) Armazena o elemento
        this._isDragging = true;

        // 2. Aplicar lógica de D&D
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.dropEffect = 'move';

        // (MODIFICADO - CORREÇÃO) Usa o 'element' do payload
        element.classList.add('dragging');
        // (MODIFICADO - CORREÇÃO) Usa o 'element' do payload
        e.dataTransfer.setDragImage(element, 20, 20);
    }

    /**
     * (MODIFICADO) Handles o 'dragend' e limpa o objeto _draggedData.
     * @private
     */
    _onDragEnd() {
        this.hidePlaceholder();
        this._clearStrategyCaches();

        // (MODIFICADO - CORREÇÃO) Usa o 'element' armazenado
        if (this._draggedData.element) {
            this._draggedData.element.classList.remove('dragging');
        }

        // Resetar Estado
        this._draggedData.item = null;
        this._draggedData.type = null;
        this._draggedData.element = null; // (NOVO) Limpa o elemento
        this._isDragging = false;
    }
}
