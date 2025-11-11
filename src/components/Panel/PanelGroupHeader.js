// (REMOVIDO) DragDropService não é mais importado
import { appBus } from '../../utils/EventBus.js';

/**
 * Description:
 * Gere o cabeçalho de um PanelGroup.
 *
 * (Refatorado vArch) Esta classe foi simplificada.
 * Ela NÃO renderiza mais as abas (isso é feito pelo PanelHeader).
 * Ela apenas fornece:
 * 1. Os controlos do Grupo (Mover, Colapsar, Fechar).
 * 2. O 'tabContainer' (onde o PanelGroup insere as abas).
 * 3. A lógica de scroll (overflow) do 'tabContainer'.
 * 4. O "Drop Zone" (Alvo D&D) do 'tabContainer' para receber Panels.
 *
 * (Refatorado vBugFix 2) O 'onGroupDragStart' agora passa o 'element'
 * explícito no payload do appBus.
 *
 * (Refatorado vCodeSmell) Removido setTimeout de updateScrollButtons.
 *
 * (Refatorado vBugFix 7) Adiciona stopPropagation() aos listeners
 * de DND do 'this.element' (header) para evitar "flickering"
 * (borbulhamento para a Column).
 *
 * (REFATORADO vDND-Bridge) Remove listeners DND locais e delega ao DragDropService
 * através de 'dataset.dropzone' e 'dropZoneInstance'.
 *
 * (CORREÇÃO vDND-Bridge-Fix-3) O 'this.element' (header) é o dropzone,
 * e lê o 'dropZoneType' do 'panelGroup' pai (que agora o possui).
 * Os stopPropagation() conflitantes do construtor são removidos.
 */
export class PanelGroupHeader {
    state = {
        title: null
    };

    /**
     * @type {ResizeObserver | null}
     * @description Observador para 'resize' do container de abas.
     * @private
     */
    _resizeObserver = null;

    constructor(panelGroup) {
        this.panelGroup = panelGroup;
        this.element = document.createElement('div');
        this.element.classList.add('panel-group__header');

        // (INÍCIO DA CORREÇÃO - Bug 1)
        // O drop zone é o header INTEIRO.
        // Ele lê o 'dropZoneType' da instância do panelGroup (definida na Parte 1)
        // e define a instância 'dropZoneInstance' como o próprio panelGroup.
        this.element.dropZoneInstance = this.panelGroup;
        // Lê o 'dropZoneType' do pai (PanelGroup.js)
        this.element.dataset.dropzone = this.panelGroup.dropZoneType;
        // (FIM DA CORREÇÃO)

        // (REMOVIDO) Os 4 listeners DND com stopPropagation()
        // que estavam no construtor foram removidos.

        this.build();

        this._initResizeObserver();
    }

    build() {
        // 1. Move Handle (para o GRUPO)
        this.moveHandle = document.createElement('div');
        this.moveHandle.classList.add('panel-group__move-handle', 'panel__move-handle');
        this.moveHandle.draggable = true;
        this.moveHandle.addEventListener('dragstart', this.onGroupDragStart.bind(this));
        this.moveHandle.addEventListener('dragend', this.onDragEnd.bind(this));
        this.moveHandle.setAttribute('role', 'button');

        const iconElement = document.createElement('span');
        iconElement.className = `icon icon-handle`;
        this.moveHandle.appendChild(iconElement);

        // 2. Botão de Scroll Esquerda
        this.scrollLeftBtn = document.createElement('button');
        this.scrollLeftBtn.type = 'button';
        this.scrollLeftBtn.classList.add(
            'panel-group__tab-scroll',
            'panel-group__tab-scroll--left'
        );
        this.scrollLeftBtn.textContent = '<';
        this.scrollLeftBtn.style.display = 'none';

        // 3. Contêiner das Abas (AGORA É DROP ZONE VAZIO)
        this.tabContainer = document.createElement('div');
        this.tabContainer.classList.add('panel-group__tab-container');

        // (INÍCIO DA CORREÇÃO - Bug 1)
        // O tabContainer NÃO é mais o dropzone. O 'this.element' (header) é.
        // Todos os listeners DND (onTabContainer...) e propriedades
        // (dropZoneType, panelGroupOwner) são removidos.
        //
        // this.tabContainer.dropZoneType = 'TabContainer'; (REMOVIDO)
        // this.tabContainer.panelGroupOwner = this.panelGroup; (REMOVIDO)
        // this.tabContainer.addEventListener('dragenter', ...); (REMOVIDO)
        // this.tabContainer.addEventListener('dragover', ...); (REMOVIDO)
        // this.tabContainer.addEventListener('dragleave', ...); (REMOVIDO)
        // this.tabContainer.addEventListener('drop', ...); (REMOVIDO)
        // (FIM DA CORREÇÃO)

        // 4. Botão de Scroll Direita
        this.scrollRightBtn = document.createElement('button');
        this.scrollRightBtn.type = 'button';
        this.scrollRightBtn.classList.add(
            'panel-group__tab-scroll',
            'panel-group__tab-scroll--right'
        );
        this.scrollRightBtn.textContent = '>';
        this.scrollRightBtn.style.display = 'none';

        // 5. Espaçador (REMOVIDO)

        // 6. Botão de Colapso (para o GRUPO)
        this.collapseBtn = document.createElement('button');
        this.collapseBtn.type = 'button';
        this.collapseBtn.classList.add('panel-group__collapse-btn', 'panel__collapse-btn');
        this.collapseBtn.addEventListener('click', () => {
            appBus.emit('panel:toggle-collapse-request', this.panelGroup);
        });

        // 7. Botão de Fechar (para o GRUPO)
        this.closeBtn = document.createElement('button');
        this.closeBtn.type = 'button';
        this.closeBtn.classList.add('panel-group__close-btn', 'panel__close-btn');
        this.closeBtn.addEventListener('click', () => {
            appBus.emit('panel:close-request', this.panelGroup);
        });

        this.element.append(
            this.moveHandle,
            this.scrollLeftBtn,
            this.tabContainer,
            this.scrollRightBtn,
            this.collapseBtn,
            this.closeBtn
        );

        // Adiciona listeners de scroll
        this.scrollLeftBtn.addEventListener('click', () =>
            this.tabContainer.scrollBy({ left: -100, behavior: 'smooth' })
        );
        this.scrollRightBtn.addEventListener('click', () =>
            this.tabContainer.scrollBy({ left: 100, behavior: 'smooth' })
        );
        this.tabContainer.addEventListener('scroll', this.updateScrollButtons.bind(this));
    }

    // (INÍCIO DA CORREÇÃO - Bug 1)
    // --- Handlers de D&D (Drop Zone) ---
    // (REMOVIDO) Métodos onTabContainerDragEnter, onTabContainerDragOver,
    // onTabContainerDragLeave, onTabContainerDrop (pois os listeners foram removidos)
    // (FIM DA CORREÇÃO)

    /**
     * Configura o ResizeObserver para chamar updateScrollButtons
     * sempre que o 'tabContainer' mudar de tamanho (ex: adição de aba).
     * @private
     */
    _initResizeObserver() {
        this._resizeObserver = new ResizeObserver(this.updateScrollButtons.bind(this));
        this._resizeObserver.observe(this.tabContainer);
    }

    /**
     * Limpa o observador para evitar memory leaks.
     */
    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
    }

    /**
     * (Mantido) Atualiza os botões de scroll
     * Esta função é agora chamada pelo PanelGroup (Etapa 4)
     * (MODIFICADO) Removido o setTimeout
     */
    updateScrollButtons() {
        const { scrollLeft, scrollWidth, clientWidth } = this.tabContainer;
        const showLeft = scrollLeft > 1;
        const showRight = scrollWidth > clientWidth + 1;
        this.scrollLeftBtn.style.display = showLeft ? '' : 'none';
        this.scrollRightBtn.style.display = showRight ? '' : 'none';
    }

    /**
     * (Mantido) Atualiza os botões de controlo do GRUPO
     * Esta função é agora chamada pelo PanelGroup (Etapa 4)
     */
    updateAriaLabels() {
        const title = this.panelGroup.state.title;
        this.moveHandle.setAttribute('aria-label', `Mover grupo ${title}`);
        this.collapseBtn.setAttribute('aria-label', `Recolher grupo ${title}`);
        this.closeBtn.setAttribute('aria-label', `Fechar grupo ${title}`);
    }

    // --- Handlers de D&D (Drag Source do Grupo) ---
    onGroupDragStart(e) {
        if (!this.panelGroup.state.movable) return;

        // (MODIFICADO - CORREÇÃO) Passa o 'element' (this.panelGroup.element)
        appBus.emit('dragstart', {
            item: this.panelGroup,
            type: 'PanelGroup',
            element: this.panelGroup.element, // O elemento DOM do PanelGroup
            event: e
        });

        this.moveHandle.style.cursor = 'grabbing';
    }

    onDragEnd(e) {
        appBus.emit('dragend');
        this.moveHandle.style.cursor = 'grab';
    }
}
