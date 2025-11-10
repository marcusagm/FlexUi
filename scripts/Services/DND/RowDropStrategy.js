import { PanelGroup } from '../../Panel/PanelGroup.js';
import { DragDropService } from './DragDropService.js';
import { Panel } from '../../Panel/Panel.js'; // (NOVO) Importa Panel

/**
 * Description:
 * (REFATORADO) Estratégia de D&D para o 'row'.
 * Gere o drop de PanelGroups nas "lacunas" (gaps) horizontais
 * ENTRE Colunas.
 *
 * (Refatorado vFeature 2) Esta estratégia agora aceita
 * 'PanelGroup' E 'Panel'. Se um 'Panel' for solto,
 * ele é envolvido (wrapped) num novo 'Column' e 'PanelGroup'.
 */
export class RowDropStrategy {
    // (CLASSE RENOMEADA)
    /**
     * @type {Array<object>}
     * @private
     */
    _columnCache = [];

    /**
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * @type {number | null}
     * @private
     */
    _originalColumnIndex = null;

    /**
     * @type {boolean}
     * @private
     */
    _originColumnHadOnePanel = false;

    /**
     * Limpa o estado interno (cache) da estratégia.
     */
    clearCache() {
        this._columnCache = [];
        this._dropIndex = null;
        this._originalColumnIndex = null;
        this._originColumnHadOnePanel = false;
    }

    /**
     * (MODIFICADO) Constrói o cache de posições.
     * @param {DragEvent} e - O evento nativo.
     * @param {Row} dropZone - A instância da Linha. (TIPO MODIFICADO)
     * @param {{item: object, type: string}} draggedData - O item e tipo arrastados.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragEnter(e, dropZone, draggedData, dds) {
        // (MODIFICADO) Só aceita PanelGroups ou Panels
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
        const columns = dropZone.getColumns();

        // 1. Constrói o cache
        this._columnCache = columns.map((col, index) => {
            const rect = col.element.getBoundingClientRect();
            return {
                midX: rect.left + rect.width / 2,
                element: col.element,
                index: index
            };
        });

        // 2. Encontra o índice e o estado da coluna de origem
        const oldColumn = effectiveItem.getColumn();
        if (oldColumn) {
            const oldColCacheItem = this._columnCache.find(
                item => item.element === oldColumn.element
            );

            // (MODIFICADO) Verifica o item efetivo e se é o último painel
            if (oldColCacheItem) {
                this._originalColumnIndex = oldColCacheItem.index;

                // Verifica se é um PanelGroup com 1 painel (que é o próprio item)
                if (draggedData.type === 'PanelGroup' && oldColumn.getTotalPanelGroups() === 1) {
                    this._originColumnHadOnePanel = true;
                }
                // Verifica se é um Panel e se é o último no seu grupo
                else if (draggedData.type === 'Panel' && effectiveItem.state.panels.length === 1) {
                    this._originColumnHadOnePanel = true;
                }
            }
        }
    }

    /**
     * Chamado quando o mouse sai da linha.
     * @param {DragEvent} e
     * @param {Row} dropZone (TIPO MODIFICADO)
     * @param {{item: object, type: string}} draggedData
     * @param {DragDropService} dds
     */
    handleDragLeave(e, dropZone, draggedData, dds) {
        if (e.relatedTarget && dropZone.element.contains(e.relatedTarget)) {
            return;
        }
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * Manipula a lógica de 'dragover' na linha.
     * @param {DragEvent} e
     * @param {Row} dropZone (TIPO MODIFICADO)
     * @param {{item: object, type: string}} draggedData
     * @param {DragDropService} dds
     */
    handleDragOver(e, dropZone, draggedData, dds) {
        // (MODIFICADO) Só aceita PanelGroups ou Panels
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        if (this._columnCache.length === 0) {
            // (MODIFICADO) Permite o drop numa linha vazia (cria a primeira coluna)
            // return;
        }

        const mouseX = e.clientX;
        let gapFound = false;

        // 1. Calcula o índice da lacuna (this._dropIndex)
        this._dropIndex = this._columnCache.length;
        for (const col of this._columnCache) {
            if (mouseX < col.midX) {
                this._dropIndex = col.index;
                gapFound = true;
                break;
            }
        }

        // 2. Verifica a lógica "ghost" CONDICIONAL
        const isLeftGap = this._dropIndex === this._originalColumnIndex;
        const isRightGap = this._dropIndex === this._originalColumnIndex + 1;

        // (MODIFICADO) A lógica ghost (_originColumnHadOnePanel) agora é tratada
        // pela lógica 'isEffectiveGroupDrag' da Etapa 1.
        if (
            this._originalColumnIndex !== null &&
            this._originColumnHadOnePanel &&
            (isLeftGap || isRightGap)
        ) {
            dds.hidePlaceholder();
            this._dropIndex = null;
            return;
        }

        // 3. Se não for "ghost", mostra o placeholder vertical
        dds.showPlaceholder('vertical');
        const placeholder = dds.getPlaceholder();

        if (gapFound) {
            const targetElement = this._columnCache.find(
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
     * Manipula a lógica de 'drop' na linha.
     * @param {DragEvent} e
     * @param {Row} dropZone (TIPO MODIFICADO)
     * @param {{item: object, type: string}} draggedData
     * @param {DragDropService} dds
     */
    handleDrop(e, dropZone, draggedData, dds) {
        const panelIndex = this._dropIndex;
        dds.hidePlaceholder();
        this.clearCache();

        // (MODIFICADO) Só aceita PanelGroups ou Panels
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        if (panelIndex === null) {
            return; // Drop anulado (lógica 'ghost')
        }

        // (MODIFICADO) Lógica de Ação
        if (draggedData.type === 'PanelGroup') {
            // --- Lógica Existente (Mover PanelGroup) ---
            const draggedItem = draggedData.item;
            const oldColumn = draggedItem.getColumn();

            // 4. Cria a nova coluna na lacuna (índice) encontrada
            const newColumn = dropZone.createColumn(null, panelIndex);

            // 5. Move o painel
            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            draggedItem.state.height = null;
            newColumn.addPanelGroup(draggedItem);
        } else if (draggedData.type === 'Panel') {
            // --- Lógica Nova (Mover Panel, Criar Column e PanelGroup) ---
            const draggedPanel = draggedData.item;
            const sourceGroup = draggedPanel.state.parentGroup;

            // 1. Cria a nova Coluna
            const newColumn = dropZone.createColumn(null, panelIndex);
            // 2. Cria o novo PanelGroup (vazio)
            const newPanelGroup = new PanelGroup(null);
            newColumn.addPanelGroup(newPanelGroup);

            // 3. Move o painel
            if (sourceGroup) {
                sourceGroup.removePanel(draggedPanel);
            }
            newPanelGroup.addPanel(draggedPanel, true);
        }
    }
}
