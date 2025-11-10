import { PanelGroup } from '../../Panel/PanelGroup.js';
import { DragDropService } from './DragDropService.js';
import { Row } from '../../Row.js';

/**
 * Description:
 * (NOVO) Estratégia de D&D para o 'container' (raiz).
 * Gere o drop de PanelGroups nas "lacunas" (gaps) verticais
 * ENTRE Linhas (Rows).
 */
export class ContainerDropStrategy {
    _rowCache = [];
    _dropIndex = null;
    _originalRowIndex = null;
    _originRowHadOneColumn = false; // Se a Row de origem só tinha uma coluna

    /**
     * Limpa o estado interno (cache) da estratégia.
     */
    clearCache() {
        this._rowCache = [];
        this._dropIndex = null;
        this._originalRowIndex = null;
        this._originRowHadOneColumn = false;
    }

    /**
     * Chamado ao entrar no Container. Constrói o cache de posições das Linhas.
     * @param {DragEvent} e
     * @param {Container} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {DragDropService} dds
     */
    handleDragEnter(e, dropZone, draggedData, dds) {
        // Só aceita PanelGroups
        if (
            !draggedData.item ||
            draggedData.type !== 'PanelGroup' ||
            !(draggedData.item instanceof PanelGroup)
        ) {
            return;
        }
        const draggedItem = draggedData.item;

        this.clearCache();
        const rows = dropZone.getRows();

        // 1. Constrói o cache (vertical)
        this._rowCache = rows.map((row, index) => {
            const rect = row.element.getBoundingClientRect();
            return {
                midY: rect.top + rect.height / 2, // Lógica Vertical (Y)
                element: row.element,
                index: index
            };
        });

        // 2. Encontra a Linha de origem e o seu estado
        const oldColumn = draggedItem.getColumn();
        if (oldColumn) {
            // A "Row" é o 'parentContainer' da Coluna
            const oldRow = oldColumn.state.parentContainer;
            if (oldRow && oldRow instanceof Row) {
                const oldRowCacheItem = this._rowCache.find(
                    item => item.element === oldRow.element
                );
                if (oldRowCacheItem) {
                    this._originalRowIndex = oldRowCacheItem.index;
                    // A lógica "ghost" aplica-se se a Row de origem ficaria vazia
                    if (oldRow.getTotalColumns() === 1) {
                        this._originRowHadOneColumn = true;
                    }
                }
            }
        }
    }

    /**
     * Chamado ao sair do Container.
     * @param {DragEvent} e
     * @param {Container} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {DragDropService} dds
     */
    handleDragLeave(e, dropZone, draggedData, dds) {
        // Se está a entrar numa 'Row' filha, não limpa
        if (e.relatedTarget && dropZone.element.contains(e.relatedTarget)) {
            return;
        }
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * Manipula a lógica de 'dragover' no container (entre Linhas).
     * @param {DragEvent} e
     * @param {Container} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {DragDropService} dds
     */
    handleDragOver(e, dropZone, draggedData, dds) {
        if (!draggedData.item || draggedData.type !== 'PanelGroup') {
            return;
        }
        const draggedItem = draggedData.item;

        // Se o cache está vazio (ex: F5 ou drag de fora), tenta construir
        if (this._rowCache.length === 0 && dropZone.getRows().length > 0) {
            this.handleDragEnter(e, dropZone, draggedData, dds);
        }

        const mouseY = e.clientY; // Lógica Vertical (Y)
        let gapFound = false;

        // 1. Calcula o índice da lacuna (this._dropIndex)
        this._dropIndex = this._rowCache.length; // Padrão é o fim
        for (const row of this._rowCache) {
            if (mouseY < row.midY) {
                // Lógica Vertical (Y)
                this._dropIndex = row.index;
                gapFound = true;
                break;
            }
        }

        // 2. Verifica a lógica "ghost" (vertical)
        const isTopGap = this._dropIndex === this._originalRowIndex;
        const isBottomGap = this._dropIndex === this._originalRowIndex + 1;

        if (
            this._originalRowIndex !== null &&
            this._originRowHadOneColumn &&
            (isTopGap || isBottomGap)
        ) {
            dds.hidePlaceholder();
            this._dropIndex = null;
            return;
        }

        // 3. Se não for "ghost", mostra o placeholder HORIZONTAL
        dds.showPlaceholder('horizontal', draggedItem.element.offsetHeight);
        const placeholder = dds.getPlaceholder();

        if (gapFound) {
            const targetElement = this._rowCache.find(
                item => item.index === this._dropIndex
            )?.element;

            if (targetElement && dropZone.element.contains(targetElement)) {
                dropZone.element.insertBefore(placeholder, targetElement);
            }
        } else {
            dropZone.element.appendChild(placeholder);
        }
    }

    /**
     * Manipula a lógica de 'drop' no container (cria uma nova Linha).
     * @param {DragEvent} e
     * @param {Container} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {DragDropService} dds
     */
    handleDrop(e, dropZone, draggedData, dds) {
        const rowIndex = this._dropIndex; // O índice da lacuna (gap)
        dds.hidePlaceholder();
        this.clearCache();

        if (
            !draggedData.item ||
            draggedData.type !== 'PanelGroup' ||
            !(draggedData.item instanceof PanelGroup)
        ) {
            return;
        }
        const draggedItem = draggedData.item;

        if (rowIndex === null) {
            return; // Drop anulado (lógica 'ghost')
        }

        // Lógica Central (Ação)

        // 1. Obtém a coluna de origem
        const oldColumn = draggedItem.getColumn();

        // 2. Cria a nova Linha (Row) na lacuna vertical
        const newRow = dropZone.createRow(null, rowIndex);

        // 3. Cria uma nova Coluna (Column) *dentro* da nova Linha
        const newColumn = newRow.createColumn();

        // 4. Move o PanelGroup
        if (oldColumn) {
            // Remove o PanelGroup da coluna antiga
            oldColumn.removePanelGroup(draggedItem, true);
            // Se oldColumn.removePanelGroup fizer com que a oldRow fique vazia,
            // o appBus.emit('row:empty') (Etapa 2) tratará da limpeza.
        }
        draggedItem.state.height = null;
        newColumn.addPanelGroup(draggedItem);
    }
}
