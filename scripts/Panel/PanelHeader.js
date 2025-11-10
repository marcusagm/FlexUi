import { appBus } from '../EventBus.js';

/**
 * Description:
 * Representa o cabeçalho/aba de um Panel.
 *
 * (Refatorado vArch) Esta classe é agora um componente autocontido
 * propriedade do Panel. Ela renderiza a UI da "aba" e atua como
 * a "origem" (drag handle) para o D&D do Panel.
 *
 * (Refatorado vBugFix 2) O 'onDragStart' agora passa o 'element'
 * explícito no payload do appBus, e o DDS (Etapa 1) gere a classe .dragging.
 *
 * (Refatorado vCodeSmell) Corrigido bug de 'me' indefinido em destroy().
 *
 * (Refatorado vBugFix 3) O 'setMode' agora desativa o 'draggable'
 * no modo simples, para forçar o D&D do PanelGroup.
 */
export class PanelHeader {
    state = {
        title: null,
        panel: null, // Referência ao Panel pai
        parentGroup: null // Referência ao PanelGroup (avô)
    };

    /**
     * O elemento DOM principal (a aba: .panel-group__tab)
     * @type {HTMLElement}
     */
    element;

    /**
     * @type {HTMLElement}
     * @private
     */
    _titleEl;

    /**
     * @type {HTMLElement}
     * @private
     */
    _closeBtn;

    /**
     * @param {Panel} panel - A instância do Panel pai.
     * @param {string} title - O título inicial.
     */
    constructor(panel, title) {
        this.state.panel = panel;
        this.state.title = title;
        this.element = document.createElement('div');

        this.build();
        this.initEventListeners();
        // Aplica a configuração inicial (movable, closable) do painel
        this.updateConfig(panel.state);
    }

    /**
     * Constrói o DOM da aba.
     */
    build() {
        const me = this;
        // (MODIFICADO) O estilo base da aba é 'panel-group__tab'
        me.element.classList.add('panel-group__tab');

        // 1. Título (usa a classe base .panel__title)
        me._titleEl = document.createElement('span');
        me._titleEl.classList.add('panel__title');
        me._titleEl.textContent = me.state.title || 'Sem Título';
        me.element.appendChild(me._titleEl);

        // 2. Botão de Fechar (X)
        me._closeBtn = document.createElement('button');
        me._closeBtn.type = 'button';
        me._closeBtn.classList.add('panel-group__tab-close');
        me._closeBtn.textContent = '×';
        me.element.appendChild(me._closeBtn);
    }

    /**
     * Inicializa os listeners de D&D (Origem) e fechar.
     */
    initEventListeners() {
        const me = this;
        // D&D (Origem)
        me.element.addEventListener('dragstart', me.onDragStart.bind(me));
        me.element.addEventListener('dragend', me.onDragEnd.bind(me));

        // Fechar (X)
        me._closeBtn.addEventListener('click', me.onCloseClick.bind(me));

        // Clicar na aba para ativar
        me.element.addEventListener('click', me.onTabClick.bind(me));
    }

    /**
     * Remove os listeners para evitar memory leaks.
     * (MODIFICADO - CORREÇÃO) Adicionado 'const me = this;'
     */
    destroy() {
        const me = this; // (ADIÇÃO DA CORREÇÃO)
        this.element.removeEventListener('dragstart', this.onDragStart.bind(me));
        this.element.removeEventListener('dragend', this.onDragEnd.bind(me));
        this._closeBtn.removeEventListener('click', this.onCloseClick.bind(me));
        this.element.removeEventListener('click', this.onTabClick.bind(me));
    }

    // --- Handlers de Eventos ---

    /**
     * (Origem D&D) Chamado quando o utilizador começa a arrastar a aba.
     * @param {DragEvent} e
     */
    onDragStart(e) {
        // Impede o D&D do PanelGroup (avô) de disparar
        e.stopPropagation();

        if (!this.state.panel.state.movable) {
            e.preventDefault();
            return;
        }

        // (MODIFICADO - CORREÇÃO) Passa o 'element' (this.element) no payload
        appBus.emit('dragstart', {
            item: this.state.panel,
            type: 'Panel',
            element: this.element, // O elemento DOM da aba
            event: e
        });
    }

    /**
     * Chamado quando o D&D termina (sucesso ou falha).
     * @param {DragEvent} e
     */
    onDragEnd(e) {
        e.stopPropagation();
        appBus.emit('dragend');
    }

    /**
     * Chamado quando o 'X' da aba é clicado.
     * @param {MouseEvent} e
     */
    onCloseClick(e) {
        e.stopPropagation(); // Impede o onTabClick (ativação)

        if (!this.state.panel.state.closable) return;

        if (this.state.parentGroup) {
            appBus.emit('panel:group-child-close-request', {
                panel: this.state.panel,
                group: this.state.parentGroup
            });
        }
    }

    /**
     * Chamado quando a aba é clicada (para ativação).
     * @param {MouseEvent} e
     */
    onTabClick(e) {
        if (this.state.parentGroup) {
            this.state.parentGroup.setActive(this.state.panel);
        }
    }

    // --- API Pública (usada pelo Panel e PanelGroup) ---

    /**
     * Define o PanelGroup (avô).
     * @param {PanelGroup} group
     */
    setParentGroup(group) {
        this.state.parentGroup = group;
    }

    /**
     * Atualiza o título no DOM.
     * @param {string} title
     */
    setTitle(title) {
        this.state.title = title;
        this._titleEl.textContent = title;
    }

    /**
     * Atualiza a UI com base na configuração do Panel (ex: vindo do fromJSON).
     * @param {object} config - { closable, movable }
     */
    updateConfig(config) {
        // Mostra/esconde o botão 'X'
        if (config.closable === false) {
            this._closeBtn.style.display = 'none';
        } else {
            this._closeBtn.style.display = '';
        }

        // Define se a aba é arrastável
        if (config.movable === false) {
            this.element.draggable = false;
            this.element.style.cursor = 'default';
        } else {
            this.element.draggable = true;
            this.element.style.cursor = 'grab';
        }
    }

    /**
     * (MODIFICADO - BugFix 3) Controla a aparência "simples" vs. "aba"
     * e desativa o D&D (draggable) do Panel no modo simples.
     * @param {boolean} isSimpleMode
     */
    setMode(isSimpleMode) {
        if (isSimpleMode) {
            // No modo simples, parece um cabeçalho normal
            this.element.classList.remove('panel-group__tab');
            // Remove o botão 'X' (o grupo mostra o seu próprio 'X')
            this._closeBtn.style.display = 'none';
            // (NOVO) Desativa o D&D deste elemento (o Panel)
            this.element.draggable = false;
            this.element.style.cursor = 'default';
        } else {
            // No modo aba, parece uma aba
            this.element.classList.add('panel-group__tab');
            // Restaura o botão 'X' (se 'closable')
            if (this.state.panel.state.closable) {
                this._closeBtn.style.display = '';
            }
            // (NOVO) Restaura o D&D (se 'movable')
            if (this.state.panel.state.movable) {
                this.element.draggable = true;
                this.element.style.cursor = 'grab';
            } else {
                this.element.draggable = false;
                this.element.style.cursor = 'default';
            }
        }
    }
}
