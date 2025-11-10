import { PanelGroupHeader } from './PanelGroupHeader.js';
import { appBus } from '../EventBus.js';
import { PanelFactory } from './PanelFactory.js';
import { Panel } from './Panel.js'; // (NOVO) Importar Panel para verificação
import { throttleRAF } from '../ThrottleRAF.js'; // Importa o throttleRAF

/**
 * Description:
 * Manages a group of Panel (tabs) within a Column.
 *
 * (Refatorado vArch) Esta classe é agora uma "Orquestradora".
 * Ela não renderiza abas. Ela pede ao Panel (filho) o seu
 * 'header.element' (aba) e 'content.element' (conteúdo) e
 * anexa-os aos seus contentores corretos (o TabContainer e o ContentContainer).
 *
 * (Refatorado vOpt 5) A lógica de 'setMode' foi movida de _updateHeaderMode (O(N))
 * para addPanel/removePanel (O(1) ou O(2)), tratando apenas as transições.
 *
 * Properties summary:
 * - state {object} : Internal state management.
 */
export class PanelGroup {
    /**
     * @type {object}
     * @private
     */
    state = {
        column: null,
        header: null, // Instância de PanelGroupHeader
        contentContainer: null, // O <div> .panel-group__content

        panels: [],
        activePanel: null,

        collapsed: false,
        height: null,
        floater: false,
        minHeight: 100,

        closable: true,
        collapsible: true,
        movable: true,
        hasTitle: true,
        title: null // (Usado para ARIA no PanelGroupHeader)
    };

    /**
     * @type {string}
     */
    id = Math.random().toString(36).substring(2, 9) + Date.now();

    /**
     * A versão throttled (com rAF) da função de atualização.
     * @type {function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * @param {Panel | null} [initialPanel=null] - O painel inicial é opcional.
     * @param {number|null} [height=null] - The initial height of the group.
     * @param {boolean} [collapsed=false] - The initial collapsed state.
     * @param {object} [config={}] - Configuration overrides for the group.
     */
    constructor(initialPanel = null, height = null, collapsed = false, config = {}) {
        Object.assign(this.state, config);

        // (MODIFICADO) O contentContainer é criado aqui
        this.state.contentContainer = document.createElement('div');
        this.state.contentContainer.classList.add('panel-group__content');

        this.state.collapsed = collapsed;
        this.element = document.createElement('div');
        this.element.classList.add('panel-group');
        this.element.classList.add('panel');

        // (MODIFICADO) O header (contentor de abas) é instanciado aqui
        this.state.header = new PanelGroupHeader(this);

        if (height !== null) {
            this.state.height = height;
        }

        this.build();

        if (initialPanel) {
            this.addPanel(initialPanel, true);
        }

        this.initEventListeners();

        // Adiciona o throttleRAF para o resize O(1)
        this.setThrottledUpdate(
            throttleRAF(() => {
                // Atualiza apenas a altura (O(1)), não o layout (O(N))
                this.updateHeight();
            })
        );
    }

    // --- Getters / Setters ---

    /**
     * Define a função de atualização throttled.
     * @param {function} throttledFunction
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * Obtém a função de atualização throttled.
     * @returns {function}
     */
    getThrottledUpdate() {
        return this._throttledUpdate;
    }

    /**
     * @returns {number}
     */
    getHeaderHeight() {
        return this.state.header ? this.state.header.element.offsetHeight : 0;
    }

    /**
     * @returns {number}
     */
    getMinPanelHeight() {
        const headerHeight = this.getHeaderHeight();
        const activeMinHeight = this.state.activePanel
            ? this.state.activePanel.getMinPanelHeight()
            : 0;

        return Math.max(this.state.minHeight, activeMinHeight) + headerHeight;
    }

    /**
     * Define a coluna pai.
     * @param {Column} column - The parent column instance.
     */
    setParentColumn(column) {
        this.state.column = column;
    }

    /**
     * Retorna a coluna pai deste grupo.
     * @returns {Column | null}
     */
    getColumn() {
        return this.state.column;
    }

    // --- Concrete Methods ---

    /**
     * Initializes event listeners for the EventBus.
     */
    initEventListeners() {
        appBus.on('panel:group-child-close-request', this.onChildCloseRequest.bind(this));
        appBus.on('panel:close-request', this.onCloseRequest.bind(this));
        appBus.on('panel:toggle-collapse-request', this.onToggleCollapseRequest.bind(this));
    }

    /**
     * Handles the request to close a child Panel (tab).
     * @param {object} eventData
     */
    onChildCloseRequest({ panel, group }) {
        if (group === this && this.state.panels.includes(panel)) {
            this.removePanel(panel);
        }
    }

    /**
     * Handles the request to close this entire PanelGroup.
     * @param {Panel | PanelGroup} panel
     */
    onCloseRequest(panel) {
        if (panel === this) {
            this.close();
        }
    }

    /**
     * Handles the request to toggle the collapse state of this PanelGroup.
     * @param {Panel | PanelGroup} panel
     */
    onToggleCollapseRequest(panel) {
        if (panel === this) {
            this.toggleCollapse();
        }
    }

    /**
     * Cleans up event listeners when the group is destroyed.
     */
    destroy() {
        appBus.off('panel:group-child-close-request', this.onChildCloseRequest.bind(this));
        appBus.off('panel:close-request', this.onCloseRequest.bind(this));
        appBus.off('panel:toggle-collapse-request', this.onToggleCollapseRequest.bind(this));

        // Garante que o ResizeObserver do header seja desconectado
        this.state.header?.destroy();

        // (NOVO) Destrói todos os painéis filhos (que limpam seus headers)
        this.state.panels.forEach(panel => panel.destroy());

        // Cancela qualquer atualização de resize pendente
        this.getThrottledUpdate()?.cancel();
    }

    /**
     * Builds the DOM structure of the PanelGroup.
     */
    build() {
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.classList.add('panel-group__resize-handle');
        this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));

        this.element.append(
            this.state.header.element, // O cabeçalho (contentor de abas)
            this.state.contentContainer, // O contentor de conteúdo
            this.resizeHandle
        );

        if (!this.state.movable) {
            this.element.classList.add('panel--not-movable');
        }

        this.updateCollapse();
    }

    /**
     * @returns {string}
     */
    getPanelType() {
        return 'PanelGroup';
    }

    /**
     * Verifica se este painel pode ser recolhido.
     */
    canCollapse() {
        if (!this.state.column) return false;
        if (!this.state.collapsible) return false;

        const uncollapsedGroups = this.state.column.getPanelGroupsUncollapsed();
        return uncollapsedGroups.length > 1 || this.state.collapsed;
    }

    /**
     * Toggles the collapse state and requests a layout update.
     */
    toggleCollapse() {
        if (this.state.collapsed) {
            this.unCollapse();
        } else {
            if (!this.canCollapse()) {
                return;
            }
            this.collapse();
        }

        this.requestLayoutUpdate();
    }

    /**
     * Applies the correct visibility state based on state.collapsed.
     */
    updateCollapse() {
        if (this.state.collapsed) {
            this.collapse();
        } else {
            this.unCollapse();
        }
    }

    /**
     * Hides the content and applies collapsed styles.
     */
    collapse() {
        this.state.collapsed = true;
        this.element.classList.add('panel--collapsed');
        this.state.contentContainer.style.display = 'none';
        this.resizeHandle.style.display = 'none';
        this.updateHeight();
    }

    /**
     * Shows the content and removes collapsed styles.
     */
    unCollapse() {
        this.state.collapsed = false;
        this.element.classList.remove('panel--collapsed');
        this.state.contentContainer.style.display = ''; // (CSS fará 'flex')
        this.resizeHandle.style.display = '';
        this.updateHeight();
    }

    /**
     * Closes the entire PanelGroup and notifies the column.
     */
    close() {
        if (!this.state.closable) return;

        appBus.emit('panelgroup:removed', { panel: this, column: this.state.column });
        this.destroy();
    }

    /**
     * Updates the CSS height/flex properties based on the current state.
     */
    updateHeight() {
        if (this.state.collapsed) {
            this.element.style.height = 'auto';
            this.element.style.flex = '0 0 auto';
            this.element.classList.add('panel--collapsed');
            this.element.style.minHeight = 'auto';

            if (this.state.header) {
                this.state.header.updateScrollButtons();
            }
            return;
        }

        this.element.classList.remove('panel--collapsed');

        const minPanelHeight = this.getMinPanelHeight();
        this.element.style.minHeight = `${minPanelHeight}px`;

        if (this.state.height !== null) {
            this.element.style.height = `${this.state.height}px`;
            this.element.style.flex = '0 0 auto';
        } else {
            this.element.style.height = 'auto';
            this.element.style.flex = '0 0 auto';
        }

        if (this.state.header) {
            this.state.header.updateScrollButtons();
        }
    }

    /**
     * (MODIFICADO) Handles the start of a vertical resize drag.
     * @param {MouseEvent} e - The mousedown event.
     */
    startResize(e) {
        e.preventDefault();
        const me = this;
        const startY = e.clientY;
        const startH = me.element.offsetHeight;

        const minPanelHeight = me.getMinPanelHeight();

        const onMove = ev => {
            const delta = ev.clientY - startY;
            me.state.height = Math.max(minPanelHeight, startH + delta);

            // (MODIFICADO) Chama a função throttled (O(1))
            me.getThrottledUpdate()();
            // (REMOVIDO) me.requestLayoutUpdate();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);

            // (NOVO) Cancela qualquer frame O(1) pendente
            me.getThrottledUpdate()?.cancel();

            // (Mantido) Chama a atualização O(N) uma única vez no final
            me.requestLayoutUpdate();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * (MODIFICADO - Otimização 5) Atualiza o estado visual do cabeçalho
     * (modo simples vs. modo abas).
     * Esta função agora é O(1) e não itera mais sobre os painéis filhos.
     * @private
     */
    _updateHeaderMode() {
        if (!this.state.header) return;

        const isSimpleMode = this.state.panels.length === 1;

        // 1. Aplica a classe ao container do cabeçalho (para CSS)
        this.state.header.element.classList.toggle('panel-group__header--simple', isSimpleMode);

        // 2. (REMOVIDO) O loop O(N) que chamava setMode foi movido
        // para addPanel e removePanel.

        // 3. Atualiza os botões de controlo do GRUPO
        if (isSimpleMode && this.state.panels.length === 1) {
            // No modo simples, os botões do grupo refletem o painel filho
            const panel = this.state.panels[0];
            this.state.header.collapseBtn.style.display =
                panel.state.collapsible && this.state.collapsible ? '' : 'none';
            this.state.header.closeBtn.style.display =
                panel.state.closable && this.state.closable ? '' : 'none';
            this.state.header.moveHandle.style.display =
                panel.state.movable && this.state.movable ? '' : 'none';
        } else {
            // No modo de abas, os botões do grupo refletem o grupo
            this.state.header.collapseBtn.style.display = this.state.collapsible ? '' : 'none';
            this.state.header.closeBtn.style.display = this.state.closable ? '' : 'none';
            this.state.header.moveHandle.style.display = this.state.movable ? '' : 'none';
        }
    }

    /**
     * (MODIFICADO - vArch / vOpt 5) Adiciona um Panel, orquestrando
     * a inserção do seu header e do seu content, e atualizando
     * os modos de UI (O(1) ou O(2)).
     * @param {Panel} panel - The panel instance to add.
     * @param {boolean} [makeActive=false]
     */
    addPanel(panel, makeActive = false) {
        if (!panel || !(panel instanceof Panel)) {
            console.warn('PanelGroup.addPanel: item não é uma instância de Panel.', panel);
            return;
        }
        if (this.state.panels.includes(panel)) {
            if (makeActive) this.setActive(panel);
            return;
        }

        // (MODIFICADO - Otimização 5) Lógica de transição O(1)/O(2)
        const currentPanelCount = this.state.panels.length;

        if (currentPanelCount === 0) {
            // Transição 0 -> 1: O novo painel está no modo simples
            panel.state.header.setMode(true);
        } else if (currentPanelCount === 1) {
            // Transição 1 -> 2: O painel antigo e o novo vão para o modo aba
            this.state.panels[0].state.header.setMode(false); // O(1)
            panel.state.header.setMode(false); // O(1)
        } else {
            // Transição N -> N+1 (N > 1): O novo painel entra no modo aba
            panel.state.header.setMode(false); // O(1)
        }
        // Fim Otimização 5

        this.state.panels.push(panel);
        panel.setParentGroup(this);

        // (MODIFICADO) Anexa o header (aba) e o conteúdo nos locais corretos
        this.state.header.tabContainer.appendChild(panel.state.header.element);
        this.state.contentContainer.appendChild(panel.getContentElement());

        this._updateHeaderMode(); // (Agora O(1))
        this.state.header.updateScrollButtons(); // Atualiza scroll

        if (makeActive || this.state.panels.length === 1) {
            this.setActive(panel);
        } else {
            // Se não for ativar, esconde o conteúdo
            panel.getContentElement().style.display = 'none';
            this.requestLayoutUpdate();
        }
    }

    /**
     * (MODIFICADO - vArch / vOpt 5) Remove um Panel (aba).
     * @param {Panel} panel - The panel instance to remove.
     */
    removePanel(panel) {
        const index = this.state.panels.indexOf(panel);
        if (index === -1) return;

        // (MODIFICADO) Remove ambos os elementos
        panel.state.header.element.remove();
        panel.getContentElement().remove();

        this.state.panels.splice(index, 1);
        panel.setParentGroup(null);

        // (MODIFICADO - Otimização 5) Lógica de transição O(1)
        const newPanelCount = this.state.panels.length;
        if (newPanelCount === 1) {
            // Transição 2 -> 1: O painel restante entra no modo simples
            this.state.panels[0].state.header.setMode(true); // O(1)
        }
        // Fim Otimização 5

        this._updateHeaderMode(); // (Agora O(1))
        this.state.header.updateScrollButtons(); // Atualiza scroll

        if (this.state.panels.length === 0) {
            this.close();
            return;
        }

        if (panel === this.state.activePanel) {
            const newActive = this.state.panels[index] || this.state.panels[index - 1];
            this.setActive(newActive);
        } else {
            this.requestLayoutUpdate();
        }
    }

    /**
     * (MODIFICADO - vArch) Ativa um Panel (aba).
     * @param {Panel} panel - The panel instance to activate.
     */
    setActive(panel) {
        if (!panel) return;

        // (NOVO - CORREÇÃO) Verifica se está em modo simples
        const isSimpleMode = this.state.panels.length === 1;

        this.state.panels.forEach(p => {
            // (MODIFICADO - CORREÇÃO) Só mexe nas classes --active se NÃO for modo simples
            if (!isSimpleMode) {
                p.state.header.element.classList.remove('panel-group__tab--active');
            }
            p.getContentElement().style.display = 'none';
        });

        // (MODIFICADO - CORREÇÃO) Só mexe nas classes --active se NÃO for modo simples
        if (!isSimpleMode) {
            panel.state.header.element.classList.add('panel-group__tab--active');
        }

        panel.getContentElement().style.display = ''; // (CSS fará 'flex')

        this.state.activePanel = panel;
        this.state.title = panel.state.title; // (Mantido para ARIA labels)
        this.state.header.updateAriaLabels(); // (NOVO) Atualiza ARIA

        this.requestLayoutUpdate();
    }

    /**
     * Emite um evento para o LayoutService APENAS se a coluna pai existir.
     */
    requestLayoutUpdate() {
        const column = this.getColumn();
        if (column) {
            appBus.emit('layout:column-changed', column);
        }
    }

    /**
     * Serializa o estado do grupo para um objeto JSON.
     * @returns {object} Um objeto JSON-friendly representando o estado.
     */
    toJSON() {
        return {
            id: this.id,
            type: this.getPanelType(),
            height: this.state.height,
            collapsed: this.state.collapsed,
            activePanelId: this.state.activePanel ? this.state.activePanel.id : null,
            config: {
                closable: this.state.closable,
                collapsible: this.state.collapsible,
                movable: this.state.movable,
                minHeight: this.state.minHeight
            },
            panels: this.state.panels.map(panel => panel.toJSON())
        };
    }

    /**
     * Restaura o estado do grupo E de seus painéis filhos.
     * @param {object} data - O objeto de estado serializado.
     */
    fromJSON(data) {
        if (data.id) {
            this.id = data.id;
        }
        if (data.height !== undefined) {
            this.state.height = data.height;
        }
        if (data.collapsed !== undefined) {
            this.state.collapsed = data.collapsed;
        }
        if (data.config) {
            Object.assign(this.state, data.config);
        }

        if (data.panels && Array.isArray(data.panels)) {
            const factory = PanelFactory.getInstance();

            data.panels.forEach(panelData => {
                const panel = factory.createPanel(panelData);

                if (panel) {
                    const isActive = panel.id === data.activePanelId;
                    this.addPanel(panel, isActive);
                }
            });
        }

        if (!this.state.activePanel && this.state.panels.length > 0) {
            this.setActive(this.state.panels[0]);
        }

        this.updateHeight();
        this.updateCollapse();
    }
}
