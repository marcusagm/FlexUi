import { PanelGroup } from '../../Panel/PanelGroup.js';
import { DragDropService } from './DragDropService.js';
import { Panel } from '../../Panel/Panel.js'; // (NOVO) Importa Panel

/**
 * Description:
 * Uma estratégia de D&D que define o comportamento de soltura
 * para o dropZoneType 'column'.
 *
 * (Refatorado vFeature) Esta estratégia agora SÓ aceita
 * drops do tipo 'PanelGroup'.
 *
 * (Refatorado vFeature 2) Esta estratégia agora aceita
 * 'PanelGroup' E 'Panel'. Se um 'Panel' for solto,
 * ele é envolvido (wrapped) num novo 'PanelGroup'.
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
        // (MODIFICADO) Aceita PanelGroup OU Panel
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        // (MODIFICADO) Obtém o "item efetivo" (o PanelGroup) para a lógica "ghost"
        let draggedItem;
        if (draggedData.type === 'PanelGroup') {
            draggedItem = draggedData.item;
        } else if (draggedData.type === 'Panel') {
            draggedItem = draggedData.item.state.parentGroup;
            if (!draggedItem) return; // Painel órfão (não deve acontecer)
        }

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
        // (MODIFICADO) Aceita PanelGroup OU Panel
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        // (MODIFICADO) Obtém o "item efetivo" (o PanelGroup) para a lógica "ghost"
        let draggedItem;
        let isEffectiveGroupDrag = false; // Se é um grupo, ou o último painel de um grupo

        if (draggedData.type === 'PanelGroup') {
            draggedItem = draggedData.item;
            isEffectiveGroupDrag = true;
        } else if (draggedData.type === 'Panel') {
            draggedItem = draggedData.item.state.parentGroup;
            if (!draggedItem) return;
            // Se for o último painel, trata-se como arrastar o grupo (para a lógica ghost)
            if (draggedItem.state.panels.length === 1) {
                isEffectiveGroupDrag = true;
            }
        }

        // 1. Prepara o placeholder (limpa o vertical, aplica o horizontal)
        // (MODIFICADO) Usa a altura do item efetivo
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

        // (MODIFICADO) Aplica a lógica "ghost" apenas se for um "arraste de grupo efetivo"
        if (isSameColumn && isEffectiveGroupDrag && (isOriginalPosition || isBelowGhost)) {
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

        // (MODIFICADO) Aceita PanelGroup OU Panel
        if (
            !draggedData.item ||
            (draggedData.type !== 'PanelGroup' && draggedData.type !== 'Panel')
        ) {
            return;
        }

        // Se o drop foi anulado (lógica ghost)
        if (panelIndex === null) {
            // Se o item for um Panel (não o último), o dropIndex pode ser nulo
            // mas o sourceGroup ainda precisa de um update (caso o panel tenha saído
            // e voltado para a mesma coluna).
            // Se for PanelGroup, o oldColumn precisa de update.
            const itemToUpdate =
                draggedData.type === 'PanelGroup'
                    ? draggedData.item
                    : draggedData.item.state.parentGroup;

            if (itemToUpdate) {
                const oldColumn = itemToUpdate.getColumn();
                if (oldColumn) {
                    oldColumn.requestLayoutUpdate();
                }
            }
            return;
        }

        // (MODIFICADO) Lógica de Ação
        if (draggedData.type === 'PanelGroup') {
            // --- Lógica Existente (Mover PanelGroup) ---
            const draggedItem = draggedData.item;
            const oldColumn = draggedItem.getColumn();

            draggedItem.state.height = null;
            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            dropZone.addPanelGroup(draggedItem, panelIndex);
        } else if (draggedData.type === 'Panel') {
            // --- Lógica Nova (Mover Panel, Criar PanelGroup) ---
            const draggedPanel = draggedData.item;
            const sourceGroup = draggedPanel.state.parentGroup;

            // 1. Cria um novo PanelGroup wrapper na posição de drop
            const newPanelGroup = new PanelGroup();
            dropZone.addPanelGroup(newPanelGroup, panelIndex);

            // 2. Move o painel
            if (sourceGroup) {
                sourceGroup.removePanel(draggedPanel); // (O sourceGroup se auto-destruirá se ficar vazio)
            }
            newPanelGroup.addPanel(draggedPanel, true); // Adiciona e ativa
        }
    }
}
