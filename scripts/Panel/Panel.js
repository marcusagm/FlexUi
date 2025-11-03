/* === NOVO ARQUIVO: Panel.js === */
import { PanelContent } from './PanelContent.js';
import { appBus } from '../EventBus.js';

export class Panel {
    state = {
        parentGroup: null, // O PanelGroup pai
        content: null,
        height: null, // Altura preferida (se definida)
        minHeight: 100, // Altura mínima do conteúdo
        closable: true,
        collapsible: true,
        movable: true, // Se a aba pode ser arrastada
        hasTitle: true,
        title: null
    };

    // ID único para o PanelGroup gerenciar as abas
    id = Math.random().toString(36).substring(2, 9) + Date.now();

    constructor(title, height = null, config = {}) {
        Object.assign(this.state, config);

        this.state.content = new PanelContent();

        this.element = document.createElement('div');
        this.element.classList.add('panel', 'panel-group-child'); // É um filho de grupo

        const panelTitle = title !== undefined && title !== null ? String(title) : '';
        this.state.hasTitle = panelTitle.length > 0;
        this.state.title = panelTitle;

        if (height !== null) {
            this.state.height = height;
        }

        this.build();
        this.populateContent();
        this.initEventListeners();
    }

    // O Panel não tem mais um PanelHeader visível
    getHeaderHeight() {
        return 0; // O cabeçalho é virtual, gerenciado pelo grupo
    }

    getMinPanelHeight() {
        return Math.max(0, this.state.minHeight);
    }

    initEventListeners() {
        // Escuta apenas pelo seu próprio fechamento
        appBus.on('panel:close-request', this.onCloseRequest.bind(this));
    }

    onCloseRequest(panel) {
        if (panel === this) {
            this.close();
        }
    }

    destroy() {
        appBus.off('panel:close-request', this.onCloseRequest.bind(this));
    }

    build() {
        // Não há resizeHandle, nem PanelHeader
        this.element.append(this.state.content.element);
        this.updateHeight();
    }

    /**
     * @abstract
     */
    populateContent() {}

    setContent(htmlString) {
        this.state.content.element.innerHTML = htmlString;
    }

    getContentElement() {
        return this.state.content.element;
    }

    getPanelType() {
        return 'Panel';
    }

    setParentGroup(group) {
        this.state.parentGroup = group;
    }

    close() {
        if (!this.state.closable) return;

        // Avisa o grupo pai que esta aba deve ser fechada
        if (this.state.parentGroup) {
            appBus.emit('panel:group-child-close-request', {
                panel: this,
                group: this.state.parentGroup
            });
        }

        this.destroy();
    }

    updateHeight() {
        // O painel filho (aba) deve sempre preencher o contêiner de conteúdo do grupo
        this.element.style.minHeight = `${this.getMinPanelHeight()}px`;
        this.element.style.height = 'auto';
        this.element.style.flex = '1 1 auto';
    }
}
