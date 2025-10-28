import Panel from '../Panel/Panel.js';

class Column {
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
    }

    setParentContainer(container) {
        this.state.container = container;
    }

    initDragDrop() {
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
        this.element.addEventListener('drop', this.onDrop.bind(this));
    }

    addResizeBars() {
        // remove existing bars
        this.element.querySelectorAll('.resize-bar').forEach(b => b.remove());
        this.element.classList.remove('resize-right');
        const cols = this.state.container.state.columns;
        const idx = cols.findIndex(c => c.element === this.element);
        if (idx === -1 || idx === cols.length - 1) return;
        this.element.classList.add('resize-right');
        const bar = document.createElement('div');
        bar.classList.add('resize-bar');
        this.element.appendChild(bar);
        bar.addEventListener('mousedown', e => this.startResize(e, 'right'));
    }

    startResize(e, side) {
        const container = this.state.container;
        const cols = container.state.columns.map(c => c.element);
        const idx = cols.indexOf(this.element);
        if (cols.length === 1 || idx === cols.length - 1) return;
        e.preventDefault();
        const startX = e.clientX;
        const startW = this.element.offsetWidth;

        const onMove = ev => {
            const delta = ev.clientX - startX;
            this.state.width = Math.max(150, startW + delta);
            this.updateWidth();
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    updateWidth() {
        const container = this.state.container;

        const cols = container.state.columns.map(c => c.element);
        const idx = cols.indexOf(this.element);
        if (cols.length === 1 || idx === cols.length - 1) {
            this.element.style.flex = `1 1 auto`;
            return;
        }
        if (this.state.width !== null) {
            this.element.style.flex = `0 0 ${this.state.width}px`;
        }
    }

    onDragOver(e) {
        e.preventDefault();
        if (!Panel.dragged) return;
        if (Panel.placeholder.parentElement !== this.element) {
            Panel.placeholder.parentElement?.removeChild(Panel.placeholder);
            this.element.appendChild(Panel.placeholder);
        }
        const panels = Array.from(this.element.querySelectorAll('.panel'));
        let placed = false;
        for (const ch of panels) {
            const rect = ch.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
                this.element.insertBefore(Panel.placeholder, ch);
                placed = true;
                break;
            }
        }
        if (!placed) this.element.appendChild(Panel.placeholder);
    }

    onDrop(e) {
        e.preventDefault();
        if (!Panel.dragged) return;

        const oldColumn = Panel.dragged.state.column;
        Panel.dragged.element.classList.remove('dragging');

        const childrenArray = Array.from(this.element.children);
        const idx = childrenArray.indexOf(Panel.placeholder);
        Panel.placeholder.remove();

        this.updatePanelsSizes();
        oldColumn.removePanel(Panel.dragged);

        this.addPanel(Panel.dragged, idx);

        Panel.placeholder = null;
        Panel.dragged = null;
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

    updatePanelsSizes() {
        this.state.panels.forEach(panel => {
            panel.updateHeight();
        });
    }

    getPanelsCollapsed() {
        const col = this.element;
        return Array.from(col.children).filter(
            c => c.classList.contains('panel') && c.classList.contains('collapsed')
        );
    }

    getPanelsUncollapsed() {
        const col = this.element;
        return Array.from(col.children).filter(
            c => c.classList.contains('panel') && !c.classList.contains('collapsed')
        );
    }

    checkPanelsCollapsed() {
        const collapsed = this.getPanelsCollapsed();
        const totalPanels = this.getTotalPanels();

        this.state.panels.forEach(panel => {
            const idx = collapsed.indexOf(panel.element);
            if (totalPanels === collapsed.length && idx === collapsed.length - 1) {
                panel.unCollapse();
                return;
            }
        });
    }

    removePanel(panel) {
        const index = this.getPanelIndex(panel);
        this.state.panels.splice(index, 1);
        this.element.removeChild(panel.element);

        panel.setParentColumn(null);
        this.updatePanelsSizes();

        this.checkPanelsCollapsed();
        if (this.getTotalPanels() === 0) {
            this.state.container.deleteColumn(this);
        }
    }

    getPanelIndex(panel) {
        return this.state.panels.findIndex(p => p === panel);
    }

    getTotalPanels() {
        return this.state.panels.length;
    }
}

export default Column;
