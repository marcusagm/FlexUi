import { PanelGroupHeader } from './PanelGroupHeader.js';
import { appBus } from '../EventBus.js';
import { throttleRAF } from '../ThrottleRAF.js'; // 1. IMPORTAR

/**
 * Description:
 * Manages a group of Panel (tabs) within a Column. This is the main
 * "widget" that the user sees and interacts with (drag, collapse, resize).
 *
 * Properties summary:
 * - state {object} : Internal state management.
 * - _throttledUpdate {function} : (NOVO) A versão throttled da função de update.
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
     * (NOVO) A versão throttled (com rAF) da função de atualização.
     * @type {function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * @param {Panel} initialPanel - The first panel (tab) to add.
     * @param {number|null} [height=null] - The initial height of the group.
     * @param {boolean} [collapsed=false] - The initial collapsed state.
     * @param {object} [config={}] - Configuration overrides for the group.
     */
    constructor(initialPanel, height = null, collapsed = false, config = {}) {
        Object.assign(this.state, config);

        this.state.contentContainer = document.createElement('div');
        this.state.contentContainer.classList.add('panel-group__content');

        this.state.collapsed = collapsed;
        this.element = document.createElement('div');
        this.element.classList.add('panel-group');
        this.element.classList.add('panel'); // (BEM) Herda estilos do 'panel'

        this.state.header = new PanelGroupHeader(this);

        if (height !== null) {
            this.state.height = height;
        }

        this.build();
        this.addPanel(initialPanel, true);
        this.initEventListeners();

        // 2. INICIALIZAR THROTTLE (COMO NULO)
        // A função throttled será criada em setParentColumn()
        this.setThrottledUpdate(null);
    }

    // --- Getters / Setters ---

    /**
     * (NOVO) Define a função de atualização throttled.
     * @param {function | null} throttledFunction
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * (NOVO) Obtém a função de atualização throttled.
     * @returns {function | null}
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
     * (ATUALIZADO) Define a coluna pai e inicializa a função throttled.
     * @param {Column} column - The parent column instance.
     */
    setParentColumn(column) {
        this.state.column = column;

        // 3. (ATUALIZADO) Cria a função throttled quando a coluna é definida.
        if (column) {
            this.setThrottledUpdate(throttleRAF(column.updatePanelGroupsSizes.bind(column)));
        } else {
            this.setThrottledUpdate(null);
        }
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

        // Cancela qualquer frame de animação pendente
        this.getThrottledUpdate()?.cancel();

        this.state.panels.forEach(p => p.destroy());
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
     * @returns {boolean}
     */
    canCollapse() {
        if (!this.state.column) return false;
        if (!this.state.collapsible) return false;

        return this.state.column.getPanelGroupsUncollapsed().length > 1;
    }

    /**
     * Toggles the collapse state of the group.
     */
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
        this.state.column?.updatePanelGroupsSizes();
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
     * (ATUALIZADO) Handles the start of a vertical resize drag.
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

            // 4. APLICAR O THROTTLE
            // Em vez de chamar me.state.column?.updatePanelGroupsSizes() diretamente...
            const updater = me.getThrottledUpdate();
            if (updater) {
                updater();
            }
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);

            // 5. LIMPAR E GARANTIR O ESTADO FINAL
            const updater = me.getThrottledUpdate();
            if (updater) {
                updater.cancel();
            }
            // Executa uma atualização final
            me.state.column?.updatePanelGroupsSizes();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * Adds a new Panel (tab) to this group.
     * @param {Panel} panel - The panel instance to add.
     * @param {boolean} [makeActive=true] - Whether to make this new panel active.
     */
    addPanel(panel, makeActive = false) {
        if (this.state.panels.includes(panel)) {
            if (makeActive) this.setActive(panel);
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
        }

        this.state.column?.updatePanelGroupsSizes();
    }

    /**
     * Removes a Panel (tab) from this group.
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
        }

        this.state.header.updateTabs();
        this.state.column?.updatePanelGroupsSizes();
    }

    /**
     * Sets a specific Panel (tab) as the active, visible one.
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
        this.state.column?.updatePanelGroupsSizes();
    }

    /**
     * Legacy/proxy drag start event from the header.
     * @param {DragEvent} e
     */
    onDragStart(e) {
        if (!this.state.movable) return;
        appBus.emit('dragstart', { item: this, event: e });
    }
}
