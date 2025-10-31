import { PanelContent } from './PanelContent.js';
import { PanelHeader } from './PanelHeader.js';
import { appBus } from '../EventBus.js';

export class Panel {
    state = {
        column: null,
        header: null,
        content: null,
        collapsed: false,
        height: null,
        floater: false,
        minHeight: 100, // minHeight representa a altura mínima do CONTEÚDO
        closable: true,
        collapsible: true,
        movable: true,
        hasTitle: true,
        title: null
    };

    constructor(title, height = null, collapsed = false, config = {}) {
        // 1. APLICA CONFIGURAÇÃO
        Object.assign(this.state, config);

        this.state.content = new PanelContent();
        this.state.collapsed = collapsed;
        this.element = document.createElement('div');
        this.element.classList.add('panel');

        const panelTitle = title !== undefined && title !== null ? String(title) : '';
        this.state.hasTitle = panelTitle.length > 0;
        this.state.title = panelTitle;

        // 2. CRIAÇÃO CONDICIONAL DO HEADER
        if (
            this.state.movable ||
            this.state.hasTitle ||
            this.state.collapsible ||
            this.state.closable
        ) {
            this.state.header = new PanelHeader(this, panelTitle);
        } else {
            this.state.header = null;
            this.element.classList.add('panel--no-header');
        }

        if (height !== null) {
            this.state.height = height;
        }

        this.build();
        this.populateContent();
        this.initEventListeners();
    }

    // Calcula a altura do cabeçalho (0 se não houver).
    getHeaderHeight() {
        return this.state.header ? this.state.header.element.offsetHeight : 0;
    }

    // NOVO: Calcula a altura mínima total do painel (Conteúdo Mínimo + Altura do Header).
    getMinPanelHeight() {
        const headerHeight = this.getHeaderHeight();
        // Usamos Math.max para garantir que o minHeight do conteúdo seja pelo menos 0,
        // caso alguém o defina como negativo.
        return Math.max(0, this.state.minHeight) + headerHeight;
    }

    initEventListeners() {
        appBus.on('panel:close-request', this.onCloseRequest.bind(this));
        appBus.on('panel:toggle-collapse-request', this.onToggleCollapseRequest.bind(this));
    }

    onCloseRequest(panel) {
        if (panel === this) {
            this.close();
        }
    }

    onToggleCollapseRequest(panel) {
        if (panel === this) {
            this.toggleCollapse();
        }
    }

    destroy() {
        appBus.off('panel:close-request', this.onCloseRequest.bind(this));
        appBus.off('panel:toggle-collapse-request', this.onToggleCollapseRequest.bind(this));
    }

    build() {
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.classList.add('resize-handle');
        this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));

        // ADIÇÃO CONDICIONAL DO HEADER
        if (this.state.header) {
            this.element.appendChild(this.state.header.element);
        }

        this.element.append(this.state.content.element, this.resizeHandle);

        // Adiciona classe para desabilitar o movimento no CSS, se não for movível
        if (!this.state.movable) {
            this.element.classList.add('panel--not-movable');
        }

        this.updateCollapse();
        this.updateHeight();
    }

    /**
     * @abstract
     */
    populateContent() {
        // Ex: this.state.content.element.innerHTML = 'Conteúdo Padrão';
    }

    /**
     * Define o conteúdo HTML do painel.
     * Usado para restaurar o estado.
     * @param {string} htmlString
     */
    setContent(htmlString) {
        this.state.content.element.innerHTML = htmlString;
    }

    /**
     * Retorna o elemento DOM do conteúdo para subclasses.
     * @returns {HTMLElement}
     */
    getContentElement() {
        return this.state.content.element;
    }

    /**
     * Retorna o tipo de painel, usado para salvar/restaurar.
     * @returns {string}
     */
    getPanelType() {
        return 'Panel';
    }

    setParentColumn(column) {
        this.state.column = column;
    }

    canCollapse() {
        if (!this.state.column) return false;
        if (!this.state.collapsible) return false;
        return this.state.column.getPanelsUncollapsed().length > 1;
    }

    toggleCollapse() {
        if (!this.state.collapsible) return;

        if (this.state.collapsed) {
            this.unCollapse();
        } else {
            if (!this.canCollapse()) {
                return;
            }
            this.collapse();
        }
        this.state.column?.updatePanelsSizes();
    }

    updateCollapse() {
        if (this.state.collapsed) {
            this.collapse();
        } else {
            this.unCollapse();
        }
    }

    collapse() {
        this.state.collapsed = true;
        this.element.classList.add('collapsed');
        this.state.content.element.style.display = 'none';
        this.resizeHandle.style.display = 'none';
        this.updateHeight();
    }

    unCollapse() {
        this.state.collapsed = false;
        this.element.classList.remove('collapsed');
        this.state.content.element.style.display = '';
        this.resizeHandle.style.display = '';
        this.updateHeight();
    }

    close() {
        if (!this.state.closable) return;

        appBus.emit('panel:removed', { panel: this, column: this.state.column });
        this.destroy();
    }

    updateHeight() {
        if (this.state.collapsed) {
            // Colapsado: altura automática (só o header)
            this.element.style.height = 'auto';
            this.element.style.flex = '0 0 auto';
            this.element.classList.add('collapsed');
            this.element.style.minHeight = 'auto'; // Reset minHeight quando colapsado
            return;
        }

        this.element.classList.remove('collapsed');

        // FIX CRÍTICO: Aplica min-height aqui na inicialização e atualização
        const minPanelHeight = this.getMinPanelHeight();
        this.element.style.minHeight = `${minPanelHeight}px`;

        if (this.state.height !== null) {
            // Altura fixa definida: usa a altura e não cresce
            this.element.style.height = `${this.state.height}px`;
            this.element.style.flex = '0 0 auto';
        } else {
            // Altura dinâmica: permite que o CSS decida se a classe 'panel--fills-space'
            // deve fazer o painel crescer, mas por padrão é 'auto'.
            this.element.style.height = 'auto';
            this.element.style.flex = '0 0 auto';
        }
    }

    startResize(e) {
        e.preventDefault();
        const startY = e.clientY;
        const startH = this.element.offsetHeight;

        // Usa o novo método auxiliar para o limite
        const minPanelHeight = this.getMinPanelHeight();

        const onMove = ev => {
            const delta = ev.clientY - startY;
            this.state.height = Math.max(minPanelHeight, startH + delta);
            this.state.column?.updatePanelsSizes();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
}
