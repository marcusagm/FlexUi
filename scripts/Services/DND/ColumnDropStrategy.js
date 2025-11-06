import { PanelGroup } from '../../Panel/PanelGroup.js';

/**
 * Description:
 * Uma estratégia de D&D que define o comportamento de soltura
 * para o dropZoneType 'column'.
 *
 * (OTIMIZADO) Esta classe agora usa um cache de 'dragenter' para evitar
 * 'layout thrashing' no 'dragover'.
 *
 * Notes / Additional:
 * - Esta classe é instanciada pelo App.js e injetada no DragDropService.
 */
export class ColumnDropStrategy {
    /**
     * @type {Array<object>}
     * @description Cache para as posições (midY) e elementos dos painéis na dropzone.
     * Formato: [{ element: HTMLElement, midY: number, originalIndex: number }]
     * @private
     */
    _dropZoneCache = [];

    /**
     * (NOVO) Chamado quando o mouse entra na coluna.
     * Constrói o cache de posições para evitar 'getBoundingClientRect' no 'dragover'.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     */
    handleDragEnter(e, dropZone, draggedItem) {
        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }

        // 1. Limpa o cache anterior
        this._dropZoneCache = [];

        // 2. Constrói o novo cache
        // (Assumindo que `getPanelGroups()` foi adicionado na Etapa 2)
        const panelGroups = dropZone.getPanelGroups();

        for (let i = 0; i < panelGroups.length; i++) {
            const targetGroup = panelGroups[i];

            // Não calcula o item que está sendo arrastado
            if (draggedItem === targetGroup) {
                continue;
            }

            // Esta é a única chamada de layout (cara)
            const rect = targetGroup.element.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            this._dropZoneCache.push({
                element: targetGroup.element,
                midY: midY,
                originalIndex: i // Salva o índice original para o 'dropIndex'
            });
        }
    }

    /**
     * (OTIMIZADO) Manipula a lógica de 'dragover' específica para colunas.
     * Esta versão usa o cache (`_dropZoneCache`) em vez de 'getBoundingClientRect'.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {HTMLElement} placeholder - O placeholder visual.
     */
    handleDragOver(e, dropZone, draggedItem, placeholder) {
        if (!draggedItem) {
            return;
        }

        const oldColumn = draggedItem.state.column;
        const originalIndex = oldColumn ? oldColumn.getPanelGroupIndex(draggedItem) : -1;

        let placed = false;
        // O 'dropIndex' padrão é o final da coluna (índice dos painéis totais)
        let dropIndex = dropZone.getPanelGroups().length;

        // (LOOP OTIMIZADO) Itera sobre o cache, que é muito mais rápido.
        for (const cacheItem of this._dropZoneCache) {
            // Compara a posição Y do mouse com o ponto médio (midY) cacheado
            if (e.clientY < cacheItem.midY) {
                dropZone.element.insertBefore(placeholder, cacheItem.element);
                placed = true;
                dropIndex = cacheItem.originalIndex; // Usa o índice original salvo
                break;
            }
        }

        if (!placed) {
            dropZone.element.appendChild(placeholder);
        }

        const isSameColumn = oldColumn === dropZone;
        const isOriginalPosition = dropIndex === originalIndex;
        // Se o dropIndex for o item logo abaixo do original (que foi removido do cache)
        const isBelowGhost = dropIndex === originalIndex + 1;

        if (isSameColumn && (isOriginalPosition || isBelowGhost)) {
            placeholder.remove();
        }
    }

    /**
     * (MODIFICADO) Chamado quando o mouse sai da coluna.
     * Limpa o cache de posições, mas APENAS se o mouse sair da coluna inteira
     * (e não apenas entrando em um elemento filho).
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     */
    handleDragLeave(e, dropZone) {
        // (CORREÇÃO BUG 1)
        // Verifica se o 'relatedTarget' (para onde o mouse foi)
        // ainda está dentro do elemento da coluna. Se estiver,
        // não limpa o cache (pois o mouse está apenas sobre um painel filho).
        if (e.relatedTarget && dropZone.element.contains(e.relatedTarget)) {
            return;
        }

        // Limpa o cache ao sair da zona de drop
        this._dropZoneCache = [];
    }

    /**
     * (MODIFICADO) Manipula a lógica de 'drop' específica para colunas.
     * Limpa o cache após a conclusão e chama a função correta.
     * @param {DragEvent} e - O evento nativo.
     * @param {Column} dropZone - A instância da Coluna.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {HTMLElement} placeholder - O placeholder visual.
     */
    handleDrop(e, dropZone, draggedItem, placeholder) {
        // 1. Limpa o cache imediatamente
        this._dropZoneCache = [];

        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }

        const oldColumn = draggedItem.state.column;

        // Se o placeholder não estiver nesta coluna (drop cancelado ou inválido)
        if (placeholder.parentElement !== dropZone.element) {
            // E o arraste começou nesta coluna
            if (oldColumn === dropZone) {
                // (CORREÇÃO BUG 2)
                // Apenas solicita uma atualização de layout, não chama a função inexistente.
                oldColumn.requestLayoutUpdate();
                return;
            }
        }

        // A lógica de 'dropIndex' aqui é diferente (baseada na posição do placeholder)
        // e está correta.
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
                // (CORREÇÃO BUG 2 - PREVENÇÃO)
                // Se soltou na mesma posição, apenas atualiza o layout.
                oldColumn.requestLayoutUpdate();
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
