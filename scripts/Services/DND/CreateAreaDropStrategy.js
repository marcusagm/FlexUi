import { PanelGroup } from '../../Panel/PanelGroup.js';

/**
 * Description:
 * Uma estratégia de D&D que define o comportamento de soltura
 * para o dropZoneType 'create-area'.
 *
 * Notes / Additional:
 * - Esta classe é instanciada pelo App.js e injetada no DragDropService.
 */
export class CreateAreaDropStrategy {
    /**
     * Manipula a lógica de 'dragover' específica para áreas de criação.
     * (Lógica movida do DragDropService)
     * @param {DragEvent} e - O evento nativo.
     * @param {ColumnCreateArea} dropZone - A instância da Área.
     */
    handleDragOver(e, dropZone, draggedItem, placeholder) {
        dropZone.element.classList.add('container__drop-area--active');
    }

    /**
     * Manipula a lógica de 'dragleave' específica para áreas de criação.
     * (Lógica movida do DragDropService)
     * @param {DragEvent} e - O evento nativo.
     * @param {ColumnCreateArea} dropZone - A instância da Área.
     */
    handleDragLeave(e, dropZone, draggedItem, placeholder) {
        dropZone.element.classList.remove('container__drop-area--active');
    }

    /**
     * Manipula a lógica de 'drop' específica para áreas de criação.
     * (Lógica movida do DragDropService)
     * @param {DragEvent} e - O evento nativo.
     * @param {ColumnCreateArea} dropZone - A instância da Área.
     */
    handleDrop(e, dropZone, draggedItem, placeholder) {
        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }

        // Lógica copiada de ColumnCreateArea.onDrop
        dropZone.element.classList.remove('container__drop-area--active');
        const oldColumn = draggedItem.state.column;

        const index = Array.from(dropZone.state.container.element.children).indexOf(
            dropZone.element
        );
        const newColumn = dropZone.state.container.createColumn(null, index);

        if (oldColumn) {
            oldColumn.removePanelGroup(draggedItem, true);
        }
        newColumn.addPanelGroup(draggedItem);
    }
}
