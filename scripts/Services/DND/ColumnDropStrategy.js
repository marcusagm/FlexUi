import { PanelGroup } from '../../Panel/PanelGroup.js';
import { DragDropService } from './DragDropService.js';

/**
 * Description:
 * Uma estratégia de D&D que define o comportamento de soltura
 * para o dropZoneType 'column'.
 *
 * (OTIMIZADO vPlan) Esta classe agora usa o DragDropService
 * para mostrar/esconder o placeholder global no modo 'horizontal'.
 *
 * (Refatorado vBugFix) Agora implementa clearCache() para ser chamado
 * pelo DragDropService, prevenindo estado obsoleto (stale state).
 */
export class ColumnDropStrategy {
    /**
     * @type {Array<object>}
     * @description Cache para as posições (midY) e elementos dos painéis na dropzone.
     * @private
     */
    _dropZoneCache = [];

    /**
     * @type {number | null}
     * @description O índice onde o painel será solto (calculado no dragOver).
     * @private
     */
    _dropIndex = null;

    /**
     * (NOVO - CORREÇÃO) Limpa o estado interno (cache) da estratégia.
     * Chamado pelo DragDropService no início e fim de um D&D.
     */
    clearCache() {
        this._dropZoneCache = [];
        this._dropIndex = null;
    }

    /**
     * (MODIFICADO) A assinatura agora inclui o 'dds' (DragDropService).
     * Constrói o cache de posições para evitar 'getBoundingClientRect' no 'dragover'.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragEnter(e, dropZone, draggedItem, dds) {
        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }

        // (MODIFICADO) Limpa o cache (conforme plano) para garantir
        // que é reconstruído de fresco, mesmo que o dragleave não tenha disparado.
        this.clearCache();

        // 2. Constrói o novo cache
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
     * (MODIFICADO) Manipula a lógica de 'dragover' específica para colunas.
     * Esta versão usa o cache (`_dropZoneCache`) e o placeholder do DDS.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragOver(e, dropZone, draggedItem, dds) {
        if (!draggedItem) {
            return;
        }

        // 1. Prepara o placeholder (limpa o vertical, aplica o horizontal)
        // A altura é necessária para o modo horizontal
        dds.showPlaceholder('horizontal', draggedItem.element.offsetHeight);
        const placeholder = dds.getPlaceholder();

        const oldColumn = draggedItem.getColumn();
        const originalIndex = oldColumn ? oldColumn.getPanelGroupIndex(draggedItem) : -1;

        let placed = false;
        // O 'dropIndex' agora é armazenado na instância
        this._dropIndex = dropZone.getPanelGroups().length;

        // 2. (LOOP OTIMIZADO) Itera sobre o cache.
        for (const cacheItem of this._dropZoneCache) {
            if (e.clientY < cacheItem.midY) {
                dropZone.element.insertBefore(placeholder, cacheItem.element);
                placed = true;
                this._dropIndex = cacheItem.originalIndex; // Armazena o índice
                break;
            }
        }

        if (!placed) {
            dropZone.element.appendChild(placeholder);
        }

        // 3. Lógica "Ghost" (esconde o placeholder se estiver na posição original)
        const isSameColumn = oldColumn === dropZone;
        const isOriginalPosition = this._dropIndex === originalIndex;
        const isBelowGhost = this._dropIndex === originalIndex + 1;

        if (isSameColumn && (isOriginalPosition || isBelowGhost)) {
            dds.hidePlaceholder();
            this._dropIndex = null; // Se está na posição original, o drop é nulo
        }
    }

    /**
     * (MODIFICADO) Chamado quando o mouse sai da coluna.
     * Limpa o cache e esconde o placeholder.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragLeave(e, dropZone, draggedItem, dds) {
        // Verifica se o rato está apenas a entrar num filho
        if (e.relatedTarget && dropZone.element.contains(e.relatedTarget)) {
            return;
        }

        // (MODIFICADO) Usa o clearCache() para consistência
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * (MODIFICADO) Manipula a lógica de 'drop' específica para colunas.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDrop(e, dropZone, draggedItem, dds) {
        // 1. Obtém o índice de drop (calculado no dragOver)
        const panelIndex = this._dropIndex;

        // 2. Limpa o placeholder e o cache
        dds.hidePlaceholder();
        this.clearCache(); // (MODIFICADO) Usa o método centralizado

        // 3. Valida o drop
        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }

        // Se o dropIndex foi anulado (posição original)
        if (panelIndex === null) {
            // Se soltou na mesma posição, apenas atualiza o layout.
            const oldColumn = draggedItem.getColumn();
            if (oldColumn) {
                oldColumn.requestLayoutUpdate();
            }
            return;
        }

        const oldColumn = draggedItem.getColumn();

        // 4. Move o painel
        draggedItem.state.height = null; // Reseta a altura ao mover
        if (oldColumn) {
            oldColumn.removePanelGroup(draggedItem, true);
        }
        dropZone.addPanelGroup(draggedItem, panelIndex);
    }
}
