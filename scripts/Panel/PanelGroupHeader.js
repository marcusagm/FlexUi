import { appBus } from '../EventBus.js';

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
        this.build();

        // (NOVO) Inicializa o ResizeObserver para monitorar o container de abas
        this._initResizeObserver();
    }

    build() {
        // 1. Move Handle (para o GRUPO)
        this.moveHandle = document.createElement('div');
        this.moveHandle.classList.add('panel-group__move-handle', 'panel__move-handle');
        this.moveHandle.draggable = true;
        this.moveHandle.addEventListener('dragstart', this.onDragStart.bind(this));
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

        // 3. Contêiner das Abas
        this.tabContainer = document.createElement('div');
        this.tabContainer.classList.add('panel-group__tab-container');

        // 4. Botão de Scroll Direita
        this.scrollRightBtn = document.createElement('button');
        this.scrollRightBtn.type = 'button';
        this.scrollRightBtn.classList.add(
            'panel-group__tab-scroll',
            'panel-group__tab-scroll--right'
        );
        this.scrollRightBtn.textContent = '>';
        this.scrollRightBtn.style.display = 'none';

        // 5. Espaçador
        this.spacerEl = document.createElement('div');
        this.spacerEl.classList.add('panel__header-spacer');

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
            this.spacerEl,
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

    /**
     * (NOVO) Configura o ResizeObserver para chamar updateScrollButtons
     * sempre que o 'tabContainer' mudar de tamanho (ex: adição de aba).
     * @private
     */
    _initResizeObserver() {
        // O callback é amarrado (bind) para manter o contexto 'this'
        this._resizeObserver = new ResizeObserver(this.updateScrollButtons.bind(this));
        // Observa o elemento do container de abas
        this._resizeObserver.observe(this.tabContainer);
    }

    /**
     * (NOVO) Limpa o observador para evitar memory leaks.
     */
    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
    }

    updateTabs() {
        const panels = this.panelGroup.state.panels;
        const activePanel = this.panelGroup.state.activePanel;

        this.tabContainer.innerHTML = ''; // Limpa as abas

        // Se houver apenas 1 painel, age como um cabeçalho simples
        if (panels.length === 1) {
            const panel = panels[0];
            this.element.classList.add('panel-group__header--simple');

            const titleEl = document.createElement('div');
            titleEl.classList.add('panel__title', 'panel-group__title-simple');
            titleEl.textContent = panel.state.title || 'Sem Título';
            this.tabContainer.appendChild(titleEl);

            // Atualiza os botões do grupo com base no painel filho
            this.collapseBtn.style.display = this.panelGroup.state.collapsible ? '' : 'none';
            this.closeBtn.style.display = this.panelGroup.state.closable ? '' : 'none';
            this.moveHandle.style.display = this.panelGroup.state.movable ? '' : 'none';
        } else {
            // Se houver múltiplas abas
            this.element.classList.remove('panel-group__header--simple');

            panels.forEach(panel => {
                this.tabContainer.appendChild(this.createTabElement(panel, activePanel));
            });

            // Os botões do grupo estão sempre visíveis (se o grupo permitir)
            this.collapseBtn.style.display = this.panelGroup.state.collapsible ? '' : 'none';
            this.closeBtn.style.display = this.panelGroup.state.closable ? '' : 'none';
            this.moveHandle.style.display = this.panelGroup.state.movable ? '' : 'none';
        }

        this.updateAriaLabels();
    }

    // Cria um elemento de aba
    createTabElement(panel, activePanel) {
        const tab = document.createElement('div');
        tab.classList.add('panel-group__tab');
        tab.dataset.panelId = panel.id;

        if (panel === activePanel) {
            tab.classList.add('panel-group__tab--active');
        }

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('panel-group__tab-title');
        titleSpan.textContent = panel.state.title || 'Sem Título';
        tab.appendChild(titleSpan);

        // Botão de fechar (X) na aba
        if (panel.state.closable) {
            const closeTabBtn = document.createElement('button');
            closeTabBtn.type = 'button';
            closeTabBtn.classList.add('panel-group__tab-close');
            closeTabBtn.textContent = '×';
            closeTabBtn.addEventListener('click', e => {
                e.stopPropagation(); // Evita a mudança de aba
                panel.close(); // Chama o fechamento do painel filho
            });
            tab.appendChild(closeTabBtn);
        }

        tab.addEventListener('click', () => this.panelGroup.setActive(panel));

        return tab;
    }

    updateScrollButtons() {
        const { scrollLeft, scrollWidth, clientWidth } = this.tabContainer;

        // Tolerância de 1px para cálculos de subpixel
        const showLeft = scrollLeft > 1;
        const showRight = scrollLeft < scrollWidth - clientWidth - 1;

        this.scrollLeftBtn.style.display = showLeft ? '' : 'none';
        this.scrollRightBtn.style.display = showRight ? '' : 'none';
    }

    updateAriaLabels() {
        const title = this.panelGroup.state.title;
        this.moveHandle.setAttribute('aria-label', `Mover grupo ${title}`);
        this.collapseBtn.setAttribute('aria-label', `Recolher grupo ${title}`);
        this.closeBtn.setAttribute('aria-label', `Fechar grupo ${title}`);
    }

    onDragStart(e) {
        if (!this.panelGroup.state.movable) return;
        appBus.emit('dragstart', { item: this.panelGroup, event: e });
        this.moveHandle.style.cursor = 'grabbing';
    }

    onDragEnd(e) {
        appBus.emit('dragend');
        this.moveHandle.style.cursor = 'grab';
    }
}
