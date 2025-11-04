import { PanelGroup } from '../Panel/PanelGroup.js';
import { DragDropService } from '../Services/DragDropService.js'; // IMPORTADO

/**
 * Description:
 * Gerencia as zonas de drop finas entre as colunas, usadas para criar novas colunas.
 *
 * Properties summary:
 * - state {object} : Gerenciamento de estado interno.
 * - container {Container} : A instância do Container pai.
 *
 * Notes / Additional:
 * - Esta classe agora (Req 4.7) escuta apenas o drop de PanelGroups.
 */
export class ColumnCreateArea {
    state = {
        container: null
    };

    constructor(container) {
        this.state.container = container;
        this.element = document.createElement('div');
        this.element.classList.add('container__drop-area');
        this.initDragDrop();
    }

    initDragDrop() {
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
        this.element.addEventListener('dragleave', this.onDragLeave.bind(this));
        this.element.addEventListener('drop', this.onDrop.bind(this));
    }

    onDragOver(e) {
        e.preventDefault();

        const draggedItem = DragDropService.getInstance().getDraggedItem();
        const placeholder = DragDropService.getInstance().getPlaceholder();
        if (!draggedItem) return;

        placeholder.parentElement?.removeChild(placeholder);
        this.element.classList.add('container__drop-area--active');
    }

    onDragLeave(e) {
        e.preventDefault();
        this.element.classList.remove('container__drop-area--active');
    }

    onDrop(e) {
        e.preventDefault();

        const draggedItem = DragDropService.getInstance().getDraggedItem();

        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }

        this.element.classList.remove('container__drop-area--active');
        const oldColumn = draggedItem.state.column;

        const index = Array.from(this.state.container.element.children).indexOf(this.element);
        const newColumn = this.state.container.createColumn(null, index);

        if (oldColumn) {
            oldColumn.removePanelGroup(draggedItem, true);
        }
        newColumn.addPanelGroup(draggedItem);
    }
}

