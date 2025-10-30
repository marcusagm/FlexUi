export class ColumnCreateArea {
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
        const draggedPanel = this.state.container.getDraggedPanel();
        const placeholder = this.state.container.getPlaceholder();
        if (!draggedPanel) return;

        placeholder.parentElement?.removeChild(placeholder);
        this.element.classList.add('active');
    }

    onDragLeave(e) {
        e.preventDefault();
        const draggedPanel = this.state.container.getDraggedPanel();
        if (!draggedPanel) return;
        this.element.classList.remove('active');
    }

    onDrop(e) {
        e.preventDefault();
        const draggedPanel = this.state.container.getDraggedPanel();
        if (!draggedPanel) return;

        this.element.classList.remove('active');
        const oldColumn = draggedPanel.state.column;

        // Encontra o índice deste CCA no array de children
        const index = this.state.container.state.children.indexOf(this);

        // Passa o `index` para o createColumn.
        // O container saberá que deve inserir [COL, CCA] no `index + 1`.
        const newColumn = this.state.container.createColumn(null, index);

        oldColumn.removePanel(draggedPanel);
        newColumn.addPanel(draggedPanel);
        newColumn.checkPanelsCollapsed();
    }
}
