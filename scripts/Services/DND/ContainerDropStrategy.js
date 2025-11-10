import { PanelGroup } from '../../Panel/PanelGroup.js';
import { DragDropService } from './DragDropService.js';
import { Row } from '../../Row.js';
import { Panel } from '../../Panel/Panel.js'; // (NOVO) Importa Panel

/**
 * Description:
 * (NOVO) Estratégia de D&D para o 'container' (raiz).
 * Gere o drop de PanelGroups nas "lacunas" (gaps) verticais
 * ENTRE Linhas (Rows).
 *
 * (Refatorado vFeature 2) Esta estratégia agora aceita
 * 'PanelGroup' E 'Panel'. Se um 'Panel' for solto,
 * ele é envolvido (wrapped) num novo 'Row', 'Column' e 'PanelGroup'.
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
        // (MODIFICADO) Aceita PanelGroup OU Panel
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        // (MODIFICADO) Obtém o "item efetivo" (o PanelGroup) para a lógica "ghost"
        let effectiveItem; // Este será o PanelGroup
        if (draggedData.type === 'PanelGroup') {
            effectiveItem = draggedData.item;
        } else {
            // type === 'Panel'
            effectiveItem = draggedData.item.state.parentGroup;
            if (!effectiveItem) return;
        }

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
        const oldColumn = effectiveItem.getColumn();
        if (oldColumn) {
            // A "Row" é o 'parentContainer' da Coluna
            const oldRow = oldColumn.state.parentContainer;
            if (oldRow && oldRow instanceof Row) {
                const oldRowCacheItem = this._rowCache.find(
                    item => item.element === oldRow.element
                );

                // (MODIFICADO) Verifica o item efetivo e se é o último painel
                if (oldRowCacheItem) {
                    this._originalRowIndex = oldRowCacheItem.index;
                    // A lógica "ghost" aplica-se se a Row de origem ficaria vazia
                    // (tem apenas 1 coluna, e essa coluna tem apenas 1 grupo/painel efetivo)
                    if (oldRow.getTotalColumns() === 1) {
                        if (
                            draggedData.type === 'PanelGroup' &&
                            oldColumn.getTotalPanelGroups() === 1
                        ) {
                            this._originRowHadOneColumn = true;
                        } else if (
                            draggedData.type === 'Panel' &&
                            effectiveItem.state.panels.length === 1
                        ) {
                            this._originRowHadOneColumn = true;
                        }
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
        // (MODIFICADO) Aceita PanelGroup OU Panel
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        // (MODIFICADO) Obtém o "item efetivo" (o PanelGroup) para a lógica "ghost"
        let effectiveItem;
        if (draggedData.type === 'PanelGroup') {
            effectiveItem = draggedData.item;
        } else {
            // type === 'Panel'
            effectiveItem = draggedData.item.state.parentGroup;
            if (!effectiveItem) return;
        }

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
        // (MODIFICADO) Usa a altura do item efetivo
        dds.showPlaceholder('horizontal', effectiveItem.element.offsetHeight);
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

        // (MODIFICADO) Aceita PanelGroup OU Panel
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        if (rowIndex === null) {
            return; // Drop anulado (lógica 'ghost')
        }

        // (MODIFICADO) Lógica de Ação
        if (draggedData.type === 'PanelGroup') {
            // --- Lógica Existente (Mover PanelGroup) ---
            const draggedItem = draggedData.item;
            const oldColumn = draggedItem.getColumn();

            const newRow = dropZone.createRow(null, rowIndex);
            const newColumn = newRow.createColumn();

            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            draggedItem.state.height = null;
            newColumn.addPanelGroup(draggedItem);
        } else if (draggedData.type === 'Panel') {
            // --- Lógica Nova (Mover Panel, Criar Row, Column e PanelGroup) ---
            const draggedPanel = draggedData.item;
            const sourceGroup = draggedPanel.state.parentGroup;

            // 1. Cria a nova Linha (Row) na lacuna vertical
            const newRow = dropZone.createRow(null, rowIndex);
            // 2. Cria uma nova Coluna (Column) *dentro* da nova Linha
            const newColumn = newRow.createColumn();
            // 3. Cria o novo PanelGroup (vazio)
            const newPanelGroup = new PanelGroup(null);
            newColumn.addPanelGroup(newPanelGroup);

            // 4. Move o painel
            if (sourceGroup) {
                sourceGroup.removePanel(draggedPanel);
            }
            draggedPanel.state.height = null; // Painéis soltos em novos grupos perdem a altura fixa
            newPanelGroup.addPanel(draggedPanel, true);
        }
    }
}
