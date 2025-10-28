import Panel from '../Panel/Panel.js';

class ColumnCreateArea {
    state = {
        container: null
    };

    constructor(container) {
        this.state.container = container;
        this.element = document.createElement('div');
        this.element.classList.add('column-create-area');
        this.initDragDrop();
    }

    initDragDrop() {
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
        this.element.addEventListener('dragleave', this.onDragLeave.bind(this));
        this.element.addEventListener('drop', this.onDrop.bind(this));
    }

    onDragOver(e) {
        e.preventDefault();
        if (!Panel.dragged) return;
        Panel.placeholder.parentElement?.removeChild(Panel.placeholder);

        this.element.classList.add('active');
    }

    onDragLeave(e) {
        e.preventDefault();
        if (!Panel.dragged) return;
        this.element.classList.remove('active');
    }

    onDrop(e) {
        e.preventDefault();
        if (!Panel.dragged) return;
        this.element.classList.remove('active');

        const oldColumn = Panel.dragged.state.column;
        Panel.dragged.element.classList.remove('dragging');

        const index = this.state.container.getColumnCreateAreaPosition(this);
        const newColumn = this.state.container.createColumn(null, index);

        oldColumn.removePanel(Panel.dragged);
        newColumn.addPanel(Panel.dragged);
        newColumn.checkPanelsCollapsed();

        Panel.placeholder = null;
        Panel.dragged = null;
    }
}

export default ColumnCreateArea;
