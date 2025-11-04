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
        this.element.classList.add('panel', 'panel-group__child'); // É um filho de grupo

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

    // --- Serialização ---

    /**
     * Serializa o estado do painel para um objeto JSON.
     * Classes filhas (ex: TextPanel) devem sobrescrever este método
     * para adicionar dados específicos (ex: 'content').
     * @returns {object} Um objeto JSON-friendly representando o estado.
     */
    toJSON() {
        return {
            id: this.id,
            type: this.getPanelType(),
            title: this.state.title,
            height: this.state.height, // Altura preferida
            // Salva as configurações de estado (config)
            config: {
                closable: this.state.closable,
                collapsible: this.state.collapsible,
                movable: this.state.movable,
                minHeight: this.state.minHeight
            }
            // 'content' é salvo por subclasses (ex: TextPanel)
        };
    }

    /**
     * Restaura o estado do painel a partir de um objeto JSON.
     * Este método é chamado pelo PanelFactory.
     * @param {object} data - O objeto de estado serializado.
     */
    fromJSON(data) {
        if (data.id) {
            this.id = data.id;
        }
        if (data.height !== undefined) {
            this.state.height = data.height;
        }
        if (data.title !== undefined) {
            this.state.title = data.title;
        }

        // Restaura as configurações de estado
        if (data.config) {
            Object.assign(this.state, data.config);
        }

        // 'content' é restaurado por subclasses
    }
}
