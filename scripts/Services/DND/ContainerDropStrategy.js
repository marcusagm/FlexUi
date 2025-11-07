import { PanelGroup } from '../../Panel/PanelGroup.js';
import { DragDropService } from './DragDropService.js';

/**
 * Description:
 * Uma estratégia de D&D que define o comportamento de soltura
 * para o 'container' principal.
 *
 * (Refatorado vFeature) Esta estratégia agora SÓ aceita
 * drops do tipo 'PanelGroup'.
 */
export class ContainerDropStrategy {
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
     * @param {Container} dropZone - A instância do Container.
     * @param {{item: object, type: string}} draggedData - O item e tipo arrastados.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragEnter(e, dropZone, draggedData, dds) {
        // (MODIFICADO) Só aceita PanelGroups
        if (
            !draggedData.item ||
            draggedData.type !== 'PanelGroup' ||
            !(draggedData.item instanceof PanelGroup)
        ) {
            return;
        }
        const draggedItem = draggedData.item;

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
        const oldColumn = draggedItem.getColumn();
        if (oldColumn) {
            const oldColCacheItem = this._columnCache.find(
                item => item.element === oldColumn.element
            );
            if (oldColCacheItem) {
                this._originalColumnIndex = oldColCacheItem.index;
                if (oldColumn.getTotalPanelGroups() === 1) {
                    this._originColumnHadOnePanel = true;
                }
            }
        }
    }

    /**
     * (MODIFICADO) Chamado quando o mouse sai do container.
     * @param {DragEvent} e - O evento nativo.
     * @param {Container} dropZone - A instância do Container.
     * @param {{item: object, type: string}} draggedData - O item e tipo arrastados.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragLeave(e, dropZone, draggedData, dds) {
        if (e.relatedTarget && dropZone.element.contains(e.relatedTarget)) {
            return;
        }
        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * (MODIFICADO) Manipula a lógica de 'dragover' no container.
     * @param {DragEvent} e - O evento nativo.
     * @param {Container} dropZone - A instância do Container.
     * @param {{item: object, type: string}} draggedData - O item e tipo arrastados.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragOver(e, dropZone, draggedData, dds) {
        // (MODIFICADO) Só aceita PanelGroups
        if (!draggedData.item || draggedData.type !== 'PanelGroup') {
            return;
        }

        if (this._columnCache.length === 0) {
            return;
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

        // 2. (MODIFICADO - UX 2) Verifica a lógica "ghost" CONDICIONAL
        const isLeftGap = this._dropIndex === this._originalColumnIndex;
        const isRightGap = this._dropIndex === this._originalColumnIndex + 1;

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
     * (MODIFICADO) Manipula a lógica de 'drop' no container.
     * @param {DragEvent} e - O evento nativo.
     * @param {Container} dropZone - A instância do Container.
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
            return;
        }

        const oldColumn = draggedItem.getColumn();

        // 4. Cria a nova coluna na lacuna (índice) encontrada
        const newColumn = dropZone.createColumn(null, panelIndex);

        // 5. Move o painel
        if (oldColumn) {
            oldColumn.removePanelGroup(draggedItem, true);
        }
        draggedItem.state.height = null;
        newColumn.addPanelGroup(draggedItem);
    }
}
