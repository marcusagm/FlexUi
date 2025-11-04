import { PanelGroup } from '../../Panel/PanelGroup.js';

/**
 * Description:
 * Uma estratégia de D&D que define o comportamento de soltura
 * para o dropZoneType 'column'.
 *
 * Notes / Additional:
 * - Esta classe é instanciada pelo App.js e injetada no DragDropService.
 */
export class ColumnDropStrategy {
    /**
     * @param {DragDropService} dragDropService - A instância do serviço principal.
     */
    constructor(dragDropService) {
        this.dds = dragDropService;
    }

    /**
     * Manipula a lógica de 'dragover' específica para colunas.
     * (Lógica movida do DragDropService)
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     */
    handleDragOver(e, dropZone) {
        const draggedItem = this.dds.getDraggedItem();
        const placeholder = this.dds.getPlaceholder();
        if (!draggedItem) return;

        // Lógica copiada de Column.onDragOver
        if (draggedItem instanceof PanelGroup) {
            const oldColumn = draggedItem.state.column;
            const originalIndex = oldColumn ? oldColumn.getPanelGroupIndex(draggedItem) : -1;

            let placed = false;
            let dropIndex = dropZone.state.panelGroups.length;

            for (let i = 0; i < dropZone.state.panelGroups.length; i++) {
                const targetGroup = dropZone.state.panelGroups[i];
                const targetElement = targetGroup.element;
                const rect = targetElement.getBoundingClientRect();

                if (draggedItem === targetGroup) continue;

                if (e.clientY < rect.top + rect.height / 2) {
                    dropZone.element.insertBefore(placeholder, targetElement);
                    placed = true;
                    dropIndex = i;
                    break;
                }
            }
            if (!placed) {
                dropZone.element.appendChild(placeholder);
            }

            const isSameColumn = oldColumn === dropZone;
            const isOriginalPosition = dropIndex === originalIndex;
            const isBelowGhost = dropIndex === originalIndex + 1;

            if (isSameColumn && (isOriginalPosition || isBelowGhost)) {
                placeholder.remove();
            }
        }
    }

    /**
     * Manipula a lógica de 'drop' específica para colunas.
     * (Lógica movida do DragDropService)
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     */
    handleDrop(e, dropZone) {
        const draggedItem = this.dds.getDraggedItem();
        const placeholder = this.dds.getPlaceholder();

        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }

        // Lógica copiada de Column.onDrop
        const oldColumn = draggedItem.state.column;

        if (placeholder.parentElement !== dropZone.element) {
            if (oldColumn === dropZone) {
                oldColumn.updatePanelGroupsSizes();
                return;
            }
        }

        const allChildren = Array.from(dropZone.element.children);
        let panelIndex = 0;
        for (const child of allChildren) {
            if (child === placeholder) break;
            if (child.classList.contains('panel-group')) {
                panelIndex++;
            }
        }

        placeholder.remove();

        if (oldColumn) {
            const originalIndex = oldColumn.getPanelGroupIndex(draggedItem);
            if (
                oldColumn === dropZone &&
                (panelIndex === originalIndex || panelIndex === originalIndex + 1)
            ) {
                oldColumn.updatePanelGroupsSizes();
                return;
            }
        }

        draggedItem.state.height = null;
        if (oldColumn) {
            oldColumn.removePanelGroup(draggedItem, true);
        }
        dropZone.addPanelGroup(draggedItem, panelIndex);
    }
}
