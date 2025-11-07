import { appBus } from '../EventBus.js';
// (NOVO) Importar o DDS para os novos handlers de drop
import { DragDropService } from '../Services/DND/DragDropService.js';

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
        // (MODIFICADO - Etapa 4B) Renomeado para clareza
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

        // 3. Contêiner das Abas (AGORA É DROP ZONE)
        this.tabContainer = document.createElement('div');
        this.tabContainer.classList.add('panel-group__tab-container');

        // (NOVO - Etapa 4C) Adicionar listeners D&D (Drop)
        this.tabContainer.dropZoneType = 'TabContainer';

        this.tabContainer.panelGroupOwner = this.panelGroup;

        this.tabContainer.addEventListener('dragenter', this.onTabContainerDragEnter.bind(this));
        this.tabContainer.addEventListener('dragover', this.onTabContainerDragOver.bind(this));
        this.tabContainer.addEventListener('dragleave', this.onTabContainerDragLeave.bind(this));
        this.tabContainer.addEventListener('drop', this.onTabContainerDrop.bind(this));

        // 4. Botão de Scroll Direita
        this.scrollRightBtn = document.createElement('button');
        this.scrollRightBtn.type = 'button';
        this.scrollRightBtn.classList.add(
            'panel-group__tab-scroll',
            'panel-group__tab-scroll--right'
        );
        this.scrollRightBtn.textContent = '>';
        this.scrollRightBtn.style.display = 'none';

        // 5. Espaçador (REMOVIDO - Etapa 4A)
        // this.spacerEl = document.createElement('div');
        // this.spacerEl.classList.add('panel__header-spacer');

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
            // this.spacerEl, // (REMOVIDO - Etapa 4A)
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

    // (NOVO - Etapa 4C) Handlers de D&D (Drop)
    onTabContainerDragEnter(e) {
        e.preventDefault();
        e.stopPropagation(); // Impede o Column/Container de apanhar
        DragDropService.getInstance().handleDragEnter(e, this.tabContainer);
    }
    onTabContainerDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        DragDropService.getInstance().handleDragOver(e, this.tabContainer);
    }
    onTabContainerDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        DragDropService.getInstance().handleDragLeave(e, this.tabContainer);
    }
    onTabContainerDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        DragDropService.getInstance().handleDrop(e, this.tabContainer);
    }
    // Fim dos Handlers D&D (Drop)

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

            // (MODIFICADO - Etapa 4B)
            const titleEl = document.createElement('div');
            // (MODIFICADO - Etapa 3 CSS) Usa a classe base
            titleEl.classList.add('panel__title');
            titleEl.textContent = panel.state.title || 'Sem Título';

            // (NOVO - Etapa 4B) Tornar o título arrastável (se 'movable')
            if (panel.state.movable) {
                titleEl.draggable = true;
                titleEl.addEventListener('dragstart', e => {
                    e.stopPropagation(); // Impede o group handle de disparar
                    // Emite o 'Panel' como o item, com o tipo 'Panel'
                    appBus.emit('dragstart', { item: panel, type: 'Panel', event: e });
                });
                titleEl.addEventListener('dragend', this.onDragEnd.bind(this));
            }

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
        // (NOVO) Atualiza o scroll caso as abas mudem
        this.updateScrollButtons();
    }

    // Cria um elemento de aba
    createTabElement(panel, activePanel) {
        const tab = document.createElement('div');
        tab.classList.add('panel-group__tab');
        tab.dataset.panelId = panel.id;

        if (panel === activePanel) {
            tab.classList.add('panel-group__tab--active');
        }

        // (NOVO - Etapa 4B) Tornar a aba arrastável (se 'movable')
        if (panel.state.movable) {
            tab.draggable = true;
            tab.addEventListener('dragstart', e => {
                e.stopPropagation(); // Impede o group handle de disparar
                // Emite o 'Panel' como o item, com o tipo 'Panel'
                appBus.emit('dragstart', { item: panel, type: 'Panel', event: e });
            });
            tab.addEventListener('dragend', this.onDragEnd.bind(this));
        }

        // (MODIFICADO - Etapa 3 CSS) Usa a classe base
        const titleSpan = document.createElement('span');
        titleSpan.classList.add('panel__title');
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
        // Timeout para garantir que o DOM (especialmente flex-grow) foi calculado
        setTimeout(() => {
            const { scrollLeft, scrollWidth, clientWidth } = this.tabContainer;

            // Tolerância de 1px para cálculos de subpixel
            const showLeft = scrollLeft > 1;
            const showRight = scrollWidth > clientWidth + 1; // (Corrigido: scrollWidth > clientWidth)

            this.scrollLeftBtn.style.display = showLeft ? '' : 'none';
            this.scrollRightBtn.style.display = showRight ? '' : 'none';
        }, 0); // 0ms timeout (adiar para a próxima 'tick')
    }

    updateAriaLabels() {
        const title = this.panelGroup.state.title;
        this.moveHandle.setAttribute('aria-label', `Mover grupo ${title}`);
        this.collapseBtn.setAttribute('aria-label', `Recolher grupo ${title}`);
        this.closeBtn.setAttribute('aria-label', `Fechar grupo ${title}`);
    }

    // (MODIFICADO - Etapa 4B) Renomeado para clareza
    onGroupDragStart(e) {
        if (!this.panelGroup.state.movable) return;
        // (MODIFICADO) Emite o tipo 'PanelGroup'
        appBus.emit('dragstart', { item: this.panelGroup, type: 'PanelGroup', event: e });
        this.moveHandle.style.cursor = 'grabbing';
    }

    onDragEnd(e) {
        // (MODIFICADO) Este handler agora é partilhado
        // (pelo group handle, pelas abas, e pelo título simples)
        // (Não emite dragend, pois o DDS ouve o evento nativo 'dragend'
        // ou o evento do appBus?)
        // Resposta: O DDS ouve 'appBus.on('dragend', ...)'
        // Esta implementação está incorreta.
        // O onDragEnd nativo deve ser ouvido pelo DDS,
        // mas o onDragEnd do *appBus* é o que limpa o estado.

        // CORREÇÃO: O onDragEnd do appBus é chamado pelo DDS.
        // Este handler é para o 'dragend' NATIVO.
        // O DDS já ouve 'dragend' do appBus.
        // O 'dragstart' emite no appBus, o DDS ouve e define o cursor.
        // O 'dragend' NATİVO deve disparar o 'dragend' do appBus.

        // CORREÇÃO 2: O DDS já ouve o 'dragstart' e 'dragend' do appBus.
        // O 'onDragEnd' no 'PanelGroupHeader' é para limpar o cursor.
        // O DDS (no _onDragEnd) é quem limpa o cursor 'grabbing' do item.

        // Vamos rever 'DragDropService.js' (Etapa 1):
        // _onDragStart(payload): item.element.classList.add('dragging');
        // _onDragEnd(): this._draggedData.item.element.classList.remove('dragging');

        // Conclusão: O onDragEnd aqui é quase desnecessário,
        // exceto pelo cursor do 'moveHandle'.
        // O onDragEnd do DDS é quem faz a limpeza.

        // VAMOS REVER o onDragEnd original em PanelGroupHeader.js:
        // onDragEnd(e) {
        //    appBus.emit('dragend');
        //    this.moveHandle.style.cursor = 'grab';
        // }
        // E o onDragEnd original em PanelHeader.js (o órfão):
        // onDragEnd(e) {
        //    appBus.emit('panel:dragend'); // Evento diferente
        //    this.moveHandle.style.cursor = 'grab';
        // }

        // A implementação correta é emitir 'dragend' no appBus.
        appBus.emit('dragend');

        // E redefinir o cursor específico deste handle (se for o move handle)
        this.moveHandle.style.cursor = 'grab';
    }
}
