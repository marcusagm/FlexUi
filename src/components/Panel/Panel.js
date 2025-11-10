import { PanelContent } from './PanelContent.js';
import { PanelHeader } from './PanelHeader.js';
import { appBus } from '../../utils/EventBus.js';

/**
 * Description:
 * A classe base para um Painel de conteúdo.
 *
 * (Refatorado vArch) Esta classe já não é um elemento DOM.
 * É um controlador autocontido que GERE os seus dois componentes DOM:
 * 1. this.header (instância de PanelHeader - a "aba" ou "cabeçalho")
 * 2. this.content (instância de PanelContent - o "conteúdo")
 *
 * O PanelGroup (pai) é responsável por orquestrar ONDE
 * estes dois elementos são anexados.
 *
 * (Refatorado vBugFix) Corrige o vazamento de listeners do appBus
 * (removendo o listener 'panel:close-request' que era inútil).
 */
export class Panel {
    state = {
        parentGroup: null, // O PanelGroup pai
        header: null, // (NOVO) A instância do PanelHeader
        content: null, // (MODIFICADO) A instância do PanelContent
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

        // (MODIFICADO) Instancia o seu controlador de conteúdo
        this.state.content = new PanelContent();

        // (REMOVIDO) this.element = document.createElement('div');
        // (REMOVIDO) this.element.classList.add('panel', 'panel-group__child');

        const panelTitle = title !== undefined && title !== null ? String(title) : '';
        this.state.hasTitle = panelTitle.length > 0;
        this.state.title = panelTitle;

        // (NOVO) Instancia o seu próprio cabeçalho/aba (Etapa 2)
        this.state.header = new PanelHeader(this, panelTitle);

        if (height !== null) {
            this.state.height = height;
        }

        this.build();
        this.populateContent();
        // (REMOVIDO) initEventListeners() foi removido
    }

    /**
     * (NOVO) Retorna o identificador de tipo estático para o PanelFactory.
     * @returns {string}
     */
    static get panelType() {
        return 'Panel';
    }

    // (MODIFICADO) Já não é relevante, pois o cabeçalho é um componente separado
    getHeaderHeight() {
        return this.state.header ? this.state.header.element.offsetHeight : 0;
    }

    getMinPanelHeight() {
        return Math.max(0, this.state.minHeight);
    }

    /**
     * (REMOVIDO) initEventListeners()
     */

    /**
     * (REMOVIDO) onCloseRequest()
     */

    destroy() {
        // (REMOVIDO) appBus.off('panel:close-request', ...)
        // (NOVO) Garante que o header também é limpo (ex: listeners D&D)
        if (this.state.header && typeof this.state.header.destroy === 'function') {
            this.state.header.destroy();
        }
    }

    /**
     * (MODIFICADO) A construção agora é mínima.
     * O PanelGroup fará a anexação.
     */
    build() {
        // (REMOVIDO) this.element.append(this.state.content.element);
        this.updateHeight();
    }

    /**
     * @abstract
     */
    populateContent() {}

    setContent(htmlString) {
        this.state.content.element.innerHTML = htmlString;
    }

    /**
     * (MODIFICADO) Retorna o elemento de conteúdo real
     * @returns {HTMLElement}
     */
    getContentElement() {
        return this.state.content.element;
    }

    getPanelType() {
        return 'Panel';
    }

    setParentGroup(group) {
        this.state.parentGroup = group;
        // (NOVO) Informa o header a que grupo ele pertence (para o D&D)
        if (this.state.header) {
            this.state.header.setParentGroup(group);
        }
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

    /**
     * (MODIFICADO) A altura é aplicada ao elemento de conteúdo
     */
    updateHeight() {
        const contentEl = this.getContentElement();
        if (!contentEl) return;

        contentEl.style.minHeight = `${this.getMinPanelHeight()}px`;
        contentEl.style.height = 'auto';
        contentEl.style.flex = '1 1 auto';
    }

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

    fromJSON(data) {
        if (data.id) {
            this.id = data.id;
        }
        if (data.height !== undefined) {
            this.state.height = data.height;
        }
        if (data.title !== undefined) {
            this.state.title = data.title;
            // (NOVO) Atualiza o header com o título restaurado
            if (this.state.header) {
                this.state.header.setTitle(data.title);
            }
        }

        // Restaura as configurações de estado
        if (data.config) {
            Object.assign(this.state, data.config);
            // (NOVO) Atualiza o header com as configs restauradas
            if (this.state.header) {
                this.state.header.updateConfig(data.config);
            }
        }

        // 'content' é restaurado por subclasses
    }
}
