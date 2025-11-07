import { PanelGroup } from '../../Panel/PanelGroup.js';
import { DragDropService } from './DragDropService.js';

/**
 * Description:
 * Uma estratégia de D&D que define o comportamento de soltura
 * para o dropZoneType 'column'.
 *
 * (Refatorado vFeature) Esta estratégia agora SÓ aceita
 * drops do tipo 'PanelGroup'.
 */
export class ColumnDropStrategy {
    /**
     * @type {Array<object>}
     * @private
     */
    _dropZoneCache = [];

    /**
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * Limpa o estado interno (cache) da estratégia.
     */
    clearCache() {
        this._dropZoneCache = [];
        this._dropIndex = null;
    }

    /**
     * (MODIFICADO) A assinatura agora inclui o 'draggedData' e 'dds'.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {{item: object, type: string}} draggedData - O item e tipo arrastados.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragEnter(e, dropZone, draggedData, dds) {
        // (MODIFICADO) Só aceita PanelGroups
        if (!draggedData.item || draggedData.type !== 'PanelGroup') {
            return;
        }
        const draggedItem = draggedData.item;

        this.clearCache();
        const panelGroups = dropZone.getPanelGroups();

        for (let i = 0; i < panelGroups.length; i++) {
            const targetGroup = panelGroups[i];
            if (draggedItem === targetGroup) continue;

            const rect = targetGroup.element.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            this._dropZoneCache.push({
                element: targetGroup.element,
                midY: midY,
                originalIndex: i
            });
        }
    }

    /**
     * (MODIFICADO) Manipula a lógica de 'dragover'.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {{item: object, type: string}} draggedData - O item e tipo arrastados.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragOver(e, dropZone, draggedData, dds) {
        // (MODIFICADO) Só aceita PanelGroups
        if (!draggedData.item || draggedData.type !== 'PanelGroup') {
            return;
        }
        const draggedItem = draggedData.item;

        // 1. Prepara o placeholder (limpa o vertical, aplica o horizontal)
        dds.showPlaceholder('horizontal', draggedItem.element.offsetHeight);
        const placeholder = dds.getPlaceholder();

        const oldColumn = draggedItem.getColumn();
        const originalIndex = oldColumn ? oldColumn.getPanelGroupIndex(draggedItem) : -1;

        let placed = false;
        this._dropIndex = dropZone.getPanelGroups().length;

        // 2. Itera sobre o cache.
        for (const cacheItem of this._dropZoneCache) {
            if (e.clientY < cacheItem.midY) {
                dropZone.element.insertBefore(placeholder, cacheItem.element);
                placed = true;
                this._dropIndex = cacheItem.originalIndex;
                break;
            }
        }

        if (!placed) {
            dropZone.element.appendChild(placeholder);
        }

        // 3. Lógica "Ghost"
        const isSameColumn = oldColumn === dropZone;
        const isOriginalPosition = this._dropIndex === originalIndex;
        const isBelowGhost = this._dropIndex === originalIndex + 1;

        if (isSameColumn && (isOriginalPosition || isBelowGhost)) {
            dds.hidePlaceholder();
            this._dropIndex = null;
        }
    }

    /**
     * (MODIFICADO) Manipula a lógica de 'dragleave'.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {{item: object, type: string}} draggedData - O item e tipo arrastados.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragLeave(e, dropZone, draggedData, dds) {
        // Verifica se o rato está apenas a entrar num filho
        if (e.relatedTarget && dropZone.element.contains(e.relatedTarget)) {
            return;
        }

        // Limpa independentemente do tipo, para garantir que o placeholder desaparece
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * (MODIFICADO) Manipula a lógica de 'drop'.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {{item: object, type: string}} draggedData - O item e tipo arrastados.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDrop(e, dropZone, draggedData, dds) {
        const panelIndex = this._dropIndex;
        dds.hidePlaceholder();
        this.clearCache();

        // (MODIFICADO) Só aceita PanelGroups
        if (
            !draggedData.item ||
            draggedData.type !== 'PanelGroup' ||
            !(draggedData.item instanceof PanelGroup)
        ) {
            return;
        }
        const draggedItem = draggedData.item;

        if (panelIndex === null) {
            const oldColumn = draggedItem.getColumn();
            if (oldColumn) {
                oldColumn.requestLayoutUpdate();
            }
            return;
        }

        const oldColumn = draggedItem.getColumn();

        // 4. Move o painel
        draggedItem.state.height = null;
        if (oldColumn) {
            oldColumn.removePanelGroup(draggedItem, true);
        }
        dropZone.addPanelGroup(draggedItem, panelIndex);
    }
}
