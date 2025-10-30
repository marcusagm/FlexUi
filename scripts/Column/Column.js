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

        if (placeholder.parentElement !== this.element) {
            placeholder.parentElement?.removeChild(placeholder);
            this.element.appendChild(placeholder);
        }
        const panels = Array.from(this.element.querySelectorAll('.panel'));
        let placed = false;
        for (const ch of panels) {
            const rect = ch.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
                this.element.insertBefore(placeholder, ch);
                placed = true;
                break;
            }
        }
        if (!placed) this.element.appendChild(placeholder);
    }

    onDrop(e) {
        e.preventDefault();
        const draggedPanel = this.state.container.getDraggedPanel();
        const placeholder = this.state.container.getPlaceholder();
        if (!draggedPanel) return;

        const oldColumn = draggedPanel.state.column;
        const childrenArray = Array.from(this.element.children);
        const idx = childrenArray.indexOf(placeholder);

        placeholder.remove();

        oldColumn.removePanel(draggedPanel, true);

        this.addPanel(draggedPanel, idx);
        this.updatePanelsSizes();
    }

    addPanel(panel, index = null) {
        if (index === null) {
            this.state.panels.push(panel);
            this.element.appendChild(panel.element);
        } else {
            this.state.panels.splice(index, 0, panel);
            this.element.insertBefore(panel.element, this.element.children[index]);
        }
        panel.setParentColumn(this);
        this.updatePanelsSizes();
    }

    /**
     * Atualiza o tamanho e o estado flexível dos painéis na coluna.
     * Esta é a lógica de preenchimento de espaço.
     */
    updatePanelsSizes() {
        const uncollapsedPanels = this.getPanelsUncollapsed();
        const lastUncollapsedPanel = uncollapsedPanels[uncollapsedPanels.length - 1];

        this.state.panels.forEach(panel => {
            panel.element.classList.remove('panel--fills-space');
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

    checkPanelsCollapsed() {
        const collapsed = this.getPanelsCollapsed();
        const totalPanels = this.getTotalPanels();

        this.state.panels.forEach(panel => {
            const idx = collapsed.indexOf(panel);
            if (totalPanels === collapsed.length && idx === collapsed.length - 1) {
                panel.unCollapse();
                return;
            }
        });
    }

    /**
     * Remove o painel do estado e DOM desta coluna.
     * @param {Panel} panel - O painel a ser removido.
     * @param {boolean} [emitEmpty=true] - Se deve emitir 'column:empty' se ficar vazia.
     */
    removePanel(panel, emitEmpty = true) {
        const index = this.getPanelIndex(panel);
        if (index === -1) return;

        this.state.panels.splice(index, 1);
        this.element.removeChild(panel.element);
        panel.setParentColumn(null);

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
