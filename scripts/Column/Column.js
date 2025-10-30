import { appBus } from '../EventBus.js'; // NOVO

export class Column {
    state = {
        container: null,
        panels: [],
        width: null
    };

    constructor(container, width = null) {
        this.state.container = container;
        this.element = document.createElement('div');
        this.element.classList.add('column');
        this.state.width = width;
        this.initDragDrop();

        // O local onde addResizeBars é chamado deve ser verificado para garantir
        // que painéis e resize-bars estejam na ordem desejada no DOM.
        // Assumindo que addResizeBars existe e adiciona os elementos ao this.element.
        // this.addResizeBars();

        this.initEventListeners();
    }

    initEventListeners() {
        appBus.on('panel:removed', this.onPanelRemoved.bind(this));
    }

    onPanelRemoved({ panel, column }) {
        if (column === this) {
            this.removePanel(panel, true);
        }
    }

    destroy() {
        appBus.off('panel:removed', this.onPanelRemoved.bind(this));
        [...this.state.panels].forEach(panel => panel.destroy());
    }

    setParentContainer(container) {
        this.state.container = container;
    }

    initDragDrop() {
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
        this.element.addEventListener('drop', this.onDrop.bind(this));
    }

    /**
     * Adiciona barras de redimensionamento.
     * @param {boolean} isLast - Indica se esta é a última coluna no container.
     */
    addResizeBars(isLast) {
        this.element.querySelectorAll('.resize-bar').forEach(b => b.remove());
        this.element.classList.remove('resize-right');

        if (isLast) return;

        this.element.classList.add('resize-right');
        const bar = document.createElement('div');
        bar.classList.add('resize-bar');
        this.element.appendChild(bar);
        bar.addEventListener('mousedown', e => this.startResize(e, 'right'));
    }

    startResize(e, side) {
        const container = this.state.container;

        const columns = container.state.children.filter(c => c instanceof Column);
        const cols = columns.map(c => c.element);

        const idx = cols.indexOf(this.element);
        if (cols.length === 1 || idx === cols.length - 1) return;

        e.preventDefault();
        const startX = e.clientX;
        const startW = this.element.offsetWidth;

        const onMove = ev => {
            const delta = ev.clientX - startX;
            this.state.width = Math.max(150, startW + delta);
            container.updateColumnsSizes();
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * Atualiza a largura da coluna.
     * @param {boolean} isLast - Indica se esta é a última coluna no container.
     */
    updateWidth(isLast) {
        if (isLast) {
            this.element.style.flex = `1 1 auto`;
            return;
        }
        if (this.state.width !== null) {
            this.element.style.flex = `0 0 ${this.state.width}px`;
        }
    }

    onDragOver(e) {
        e.preventDefault();
        const draggedPanel = this.state.container.getDraggedPanel();
        const placeholder = this.state.container.getPlaceholder();
        if (!draggedPanel) return;

        const oldColumn = draggedPanel.state.column;
        const originalIndex = oldColumn.getPanelIndex(draggedPanel);

        if (placeholder.parentElement !== this.element) {
            placeholder.parentElement?.removeChild(placeholder);
            this.element.appendChild(placeholder);
        }

        const panels = Array.from(this.element.querySelectorAll('.panel'));
        let placed = false;
        let dropIndex = panels.length;

        for (let i = 0; i < panels.length; i++) {
            const ch = panels[i];
            const rect = ch.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
                this.element.insertBefore(placeholder, ch);
                placed = true;
                dropIndex = i;
                break;
            }
        }
        if (!placed) {
            this.element.appendChild(placeholder);
        }
        const isSameColumn = oldColumn === this;
        const isOriginalPosition = dropIndex === originalIndex;
        const isBelowGhost = dropIndex === originalIndex + 1;

        if (isSameColumn && (isOriginalPosition || isBelowGhost)) {
            placeholder.remove();
        }
    }

    onDrop(e) {
        e.preventDefault();
        const draggedPanel = this.state.container.getDraggedPanel();
        const placeholder = this.state.container.getPlaceholder();
        if (!draggedPanel) return;

        const oldColumn = draggedPanel.state.column;

        if (placeholder.parentElement !== this.element) {
            const originalIndex = oldColumn.getPanelIndex(draggedPanel);

            draggedPanel.state.height = null;
            oldColumn.updatePanelsSizes();
            return;
        }

        const allChildren = Array.from(this.element.children);
        let panelIndex = 0;
        for (const child of allChildren) {
            if (child === placeholder) {
                break;
            }
            if (child.classList.contains('panel')) {
                panelIndex++;
            }
        }

        const originalIndex = oldColumn.getPanelIndex(draggedPanel);

        placeholder.remove();

        if (
            oldColumn === this &&
            (panelIndex === originalIndex || panelIndex === originalIndex + 1)
        ) {
            draggedPanel.state.height = null;
            oldColumn.updatePanelsSizes();
            return;
        }

        draggedPanel.state.height = null;

        oldColumn.removePanel(draggedPanel, true);
        this.addPanel(draggedPanel, panelIndex);
    }

    /**
     * Adiciona um painel à coluna.
     */
    addPanel(panel, index = null) {
        if (index === null) {
            this.state.panels.push(panel);
            this.element.appendChild(panel.element);
        } else {
            this.state.panels.splice(index, 0, panel);

            const nextSiblingPanel = this.state.panels[index + 1];
            const nextSiblingElement = nextSiblingPanel ? nextSiblingPanel.element : null;

            this.element.insertBefore(panel.element, nextSiblingElement);
        }
        panel.setParentColumn(this);

        if (this.getTotalPanels() === 1) {
            panel.state.height = null;
        }
        this.checkPanelsCollapsed();
        this.updatePanelsSizes();
    }

    /**
     * Gerencia a lógica de preenchimento de espaço (flex: 1).
     * Garante que o último painel visível sempre preencha o espaço (height=null).
     */
    updatePanelsSizes() {
        const uncollapsedPanels = this.getPanelsUncollapsed();
        const lastUncollapsedPanel = uncollapsedPanels[uncollapsedPanels.length - 1];

        this.state.panels.forEach(panel => {
            panel.element.classList.remove('panel--fills-space');
        });

        if (lastUncollapsedPanel) {
            lastUncollapsedPanel.state.height = null;
        }

        this.state.panels.forEach(panel => {
            panel.updateHeight();
        });

        if (lastUncollapsedPanel && lastUncollapsedPanel.state.height === null) {
            lastUncollapsedPanel.element.classList.add('panel--fills-space');
        }
    }

    getPanelsCollapsed() {
        return this.state.panels.filter(p => p.state.collapsed);
    }

    getPanelsUncollapsed() {
        return this.state.panels.filter(p => !p.state.collapsed);
    }

    /**
     * Garante que a coluna nunca esteja totalmente colapsada.
     */
    checkPanelsCollapsed() {
        const uncollapsed = this.getPanelsUncollapsed().length;
        const total = this.getTotalPanels();

        if (uncollapsed === 0 && total > 0) {
            this.state.panels[total - 1].unCollapse();
        }
    }

    removePanel(panel, emitEmpty = true) {
        const index = this.getPanelIndex(panel);
        if (index === -1) return;

        this.state.panels.splice(index, 1);
        panel.setParentColumn(null);

        if (this.element.contains(panel.element)) {
            this.element.removeChild(panel.element);
        }

        this.checkPanelsCollapsed();
        this.updatePanelsSizes();

        if (emitEmpty && this.getTotalPanels() === 0) {
            appBus.emit('column:empty', this);
        }
    }

    getPanelIndex(panel) {
        return this.state.panels.findIndex(p => p === panel);
    }

    getTotalPanels() {
        return this.state.panels.length;
    }
}
