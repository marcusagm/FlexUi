import { PanelGroupHeader } from './PanelGroupHeader.js';
import { appBus } from '../EventBus.js';

export class PanelGroup {
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

    id = Math.random().toString(36).substring(2, 9) + Date.now();

    constructor(initialPanel, height = null, collapsed = false, config = {}) {
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
        this.addPanel(initialPanel, true);
        this.initEventListeners();
    }

    getHeaderHeight() {
        return this.state.header ? this.state.header.element.offsetHeight : 0;
    }

    getMinPanelHeight() {
        const headerHeight = this.getHeaderHeight();
        const activeMinHeight = this.state.activePanel
            ? this.state.activePanel.getMinPanelHeight()
            : 0;

        return Math.max(this.state.minHeight, activeMinHeight) + headerHeight;
    }

    initEventListeners() {
        appBus.on('panel:group-child-close-request', this.onChildCloseRequest.bind(this));
        appBus.on('panel:close-request', this.onCloseRequest.bind(this));
        appBus.on('panel:toggle-collapse-request', this.onToggleCollapseRequest.bind(this));
    }

    onChildCloseRequest({ panel, group }) {
        if (group === this && this.state.panels.includes(panel)) {
            this.removePanel(panel);
        }
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
        appBus.off('panel:group-child-close-request', this.onChildCloseRequest.bind(this));
        appBus.off('panel:close-request', this.onCloseRequest.bind(this));
        appBus.off('panel:toggle-collapse-request', this.onToggleCollapseRequest.bind(this));
        this.state.panels.forEach(p => p.destroy());
    }

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

    getPanelType() {
        return 'PanelGroup';
    }

    setParentColumn(column) {
        this.state.column = column;
    }

    canCollapse() {
        if (!this.state.column) return false;
        if (!this.state.collapsible) return false;

        return this.state.column.getPanelGroupsUncollapsed().length > 1;
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
        this.state.column?.updatePanelGroupsSizes();
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
        this.element.classList.add('panel--collapsed');
        this.state.contentContainer.style.display = 'none';
        this.resizeHandle.style.display = 'none';
        this.updateHeight();
    }

    unCollapse() {
        this.state.collapsed = false;
        this.element.classList.remove('panel--collapsed');
        this.state.contentContainer.style.display = '';
        this.resizeHandle.style.display = '';
        this.updateHeight();
    }

    close() {
        if (!this.state.closable) return;

        appBus.emit('panelgroup:removed', { panel: this, column: this.state.column });
        this.destroy();
    }

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

    startResize(e) {
        e.preventDefault();
        const startY = e.clientY;
        const startH = this.element.offsetHeight;

        const minPanelHeight = this.getMinPanelHeight();

        const onMove = ev => {
            const delta = ev.clientY - startY;
            this.state.height = Math.max(minPanelHeight, startH + delta);
            this.state.column?.updatePanelGroupsSizes();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    addPanel(panel, makeActive = true) {
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
     * Chamado pelo PanelGroupHeader (move-handle)
     */
    onDragStart(e) {
        if (!this.state.movable) return;
        appBus.emit('dragstart', { item: this, event: e });
    }
}

