import { PanelGroupHeader } from './PanelGroupHeader.js';
import { appBus } from '../EventBus.js';
import { PanelFactory } from './PanelFactory.js';

/**
 * Description:
 * Manages a group of Panel (tabs) within a Column. This is the main
 * "widget" that the user sees and interacts with (drag, collapse, resize).
 * (Refatorado) Agora delega a lógica de layout (fills-space)
 * para o LayoutService emitindo 'layout:changed'.
 *
 * Properties summary:
 * - state {object} : Internal state management.
 *
 * Typical usage:
 * const panel = new TextPanel('My Tab');
 * const group = new PanelGroup(panel);
 * column.addPanelGroup(group);
 */
export class PanelGroup {
    /**
     * @type {object}
     * @private
     */
    state = {
        column: null,
        header: null,
        contentContainer: null,

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
        title: null
    };

    /**
     * @type {string}
     */
    id = Math.random().toString(36).substring(2, 9) + Date.now();

    /**
     * @param {Panel | null} [initialPanel=null] - O painel inicial é opcional.
     * @param {number|null} [height=null] - The initial height of the group.
     * @param {boolean} [collapsed=false] - The initial collapsed state.
     * @param {object} [config={}] - Configuration overrides for the group.
     */
    constructor(initialPanel = null, height = null, collapsed = false, config = {}) {
        Object.assign(this.state, config);

        this.state.contentContainer = document.createElement('div');
        this.state.contentContainer.classList.add('panel-group__content');

        this.state.collapsed = collapsed;
        this.element = document.createElement('div');
        this.element.classList.add('panel-group');
        this.element.classList.add('panel');

        this.state.header = new PanelGroupHeader(this);

        if (height !== null) {
            this.state.height = height;
        }

        this.build();

        if (initialPanel) {
            this.addPanel(initialPanel, true);
        }

        this.initEventListeners();
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
     * (NOVO) Retorna a coluna pai deste grupo.
     * @returns {Column | null}
     */
    getColumn() {
        return this.state.column;
    }

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
     * (MODIFICADO) Cleans up event listeners when the group is destroyed.
     */
    destroy() {
        appBus.off('panel:group-child-close-request', this.onChildCloseRequest.bind(this));
        appBus.off('panel:close-request', this.onCloseRequest.bind(this));
        appBus.off('panel:toggle-collapse-request', this.onToggleCollapseRequest.bind(this));

        // (NOVO) Garante que o ResizeObserver do header seja desconectado
        this.state.header?.destroy();
    }

    /**
     * Builds the DOM structure of the PanelGroup.
     */
    build() {
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.classList.add('panel-group__resize-handle');
        this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));

        this.element.append(
            this.state.header.element,
            this.state.contentContainer,
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
     * Ele não pode ser recolhido se for o último painel visível na coluna.
     * @returns {boolean}
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
        this.state.contentContainer.style.display = '';
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
     * Handles the start of a vertical resize drag.
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

            me.requestLayoutUpdate();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);

            me.requestLayoutUpdate();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * Adds a new Panel (tab) and requests a layout update.
     * @param {Panel} panel - The panel instance to add.
     * @param {boolean} [makeActive=false]
     */
    addPanel(panel, makeActive = false) {
        if (this.state.panels.includes(panel)) {
            if (makeActive) {
                this.setActive(panel);
            }
            return;
        }

        this.state.panels.push(panel);
        panel.setParentGroup(this);

        if (panel.element.parentElement) {
            panel.element.parentElement.removeChild(panel.element);
        }

        this.state.header.updateTabs();

        if (makeActive || this.state.panels.length === 1) {
            this.setActive(panel);
        } else {
            this.requestLayoutUpdate();
        }
    }

    /**
     * Removes a Panel (tab) and requests a layout update.
     * @param {Panel} panel - The panel instance to remove.
     */
    removePanel(panel) {
        const index = this.state.panels.indexOf(panel);
        if (index === -1) return;

        this.state.panels.splice(index, 1);

        if (this.state.contentContainer.contains(panel.element)) {
            this.state.contentContainer.removeChild(panel.element);
        }
        panel.setParentGroup(null);

        if (this.state.panels.length === 0) {
            this.close();
            return;
        }

        if (panel === this.state.activePanel) {
            const newActive = this.state.panels[index] || this.state.panels[index - 1];
            this.setActive(newActive);
        } else {
            this.state.header.updateTabs();
            this.requestLayoutUpdate();
        }
    }

    /**
     * Sets a specific Panel (tab) as active and requests a layout update.
     * @param {Panel} panel - The panel instance to activate.
     */
    setActive(panel) {
        if (!panel) return;

        this.state.panels.forEach(p => {
            p.element.style.display = 'none';
        });

        if (this.state.contentContainer.contains(panel.element) === false) {
            this.state.contentContainer.appendChild(panel.element);
        }
        panel.element.style.display = 'flex';

        this.state.activePanel = panel;

        this.state.title = panel.state.title;
        this.state.header.updateTabs();

        this.requestLayoutUpdate();
    }

    /**
     * (MODIFICADO) Emite um evento para o LayoutService APENAS se a coluna pai existir.
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
