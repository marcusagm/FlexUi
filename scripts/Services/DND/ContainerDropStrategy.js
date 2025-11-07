import { PanelGroup } from '../../Panel/PanelGroup.js';
import { DragDropService } from './DragDropService.js';

/**
 * Description:
 * Uma estratégia de D&D (conforme Req. Usuário) que define o comportamento
 * de soltura (drop) para o 'container' principal.
 *
 * (OTIMIZADO vPlan) Esta classe agora usa o DragDropService
 * para mostrar/esconder o placeholder global no modo 'vertical'.
 *
 * (Refatorado vBugFix) Agora implementa clearCache() para ser chamado
 * pelo DragDropService, prevenindo estado obsoleto (stale state).
 *
 * (Refatorado vUX) Agora implementa a lógica "ghost" para anular
 * o drop nas lacunas adjacentes à coluna de origem.
 */
export class ContainerDropStrategy {
    /**
     * @type {Array<object>}
     * @description Cache para as posições (pontos médios) e elementos das colunas.
     * @private
     */
    _columnCache = [];

    /**
     * @type {number | null}
     * @description O índice (lacuna) onde a nova coluna será criada.
     * @private
     */
    _dropIndex = null;

    /**
     * (NOVO - UX) O índice da coluna de onde o painel foi arrastado.
     * @type {number | null}
     * @private
     */
    _originalColumnIndex = null;

    _originColumnHadOnePanel = false;

    /**
     * (NOVO - CORREÇÃO) Limpa o estado interno (cache) da estratégia.
     * Chamado pelo DragDropService e pelos handlers internos.
     */
    clearCache() {
        this._columnCache = [];
        this._dropIndex = null;
        this._originalColumnIndex = null; // (MODIFICADO) Limpa o índice original
        this._originColumnHadOnePanel = false;
    }

    /**
     * (MODIFICADO) A assinatura agora inclui o 'dds' (DragDropService).
     * Constrói o cache de posições e armazena o índice original.
     * @param {DragEvent} e - O evento nativo.
     * @param {Container} dropZone - A instância do Container.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragEnter(e, dropZone, draggedItem, dds) {
        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
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

        // 2. (NOVO - UX) Encontra e armazena o índice da coluna de origem
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
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragLeave(e, dropZone, draggedItem, dds) {
        // Verifica se o rato está apenas a entrar num filho (Coluna)
        if (e.relatedTarget && dropZone.element.contains(e.relatedTarget)) {
            return;
        }

        dds.hidePlaceholder();
        this.clearCache();
    }

    /**
     * (MODIFICADO) Manipula a lógica de 'dragover' no container.
     * Implementa a lógica "ghost" para lacunas adjacentes.
     * @param {DragEvent} e - O evento nativo.
     * @param {Container} dropZone - A instância do Container.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDragOver(e, dropZone, draggedItem, dds) {
        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }
        if (this._columnCache.length === 0) {
            return;
        }

        const mouseX = e.clientX;
        let gapFound = false;

        // 1. Calcula o índice da lacuna (this._dropIndex)
        this._dropIndex = this._columnCache.length; // Padrão é o fim

        for (const col of this._columnCache) {
            if (mouseX < col.midX) {
                this._dropIndex = col.index;
                gapFound = true;
                break;
            }
        }

        // 2. (NOVO - UX) Verifica a lógica "ghost"
        // Verifica se o dropIndex é a lacuna à esquerda (mesmo índice)
        const isLeftGap = this._dropIndex === this._originalColumnIndex;
        // Verifica se o dropIndex é a lacuna à direita (índice + 1)
        const isRightGap = this._dropIndex === this._originalColumnIndex + 1;

        if (
            this._originalColumnIndex !== null &&
            this._originColumnHadOnePanel &&
            (isLeftGap || isRightGap)
        ) {
            // Se for uma lacuna adjacente, anula a operação
            dds.hidePlaceholder();
            this._dropIndex = null; // Anula o drop
            return; // Interrompe
        }

        // 3. Se não for "ghost", mostra o placeholder vertical
        dds.showPlaceholder('vertical');
        const placeholder = dds.getPlaceholder();

        if (gapFound) {
            // Encontra o elemento (coluna) nesse índice
            const targetElement = this._columnCache.find(
                item => item.index === this._dropIndex
            )?.element;

            if (targetElement && dropZone.element.contains(targetElement)) {
                dropZone.element.insertBefore(placeholder, targetElement);
            } else if (!targetElement) {
                // Caso especial: targetElement é nulo se gapFound for falso
                // (mas já tratamos isso abaixo)
            }
        } else {
            // Nenhuma lacuna encontrada (índice é o fim), adiciona ao fim
            dropZone.element.appendChild(placeholder);
        }
    }

    /**
     * (MODIFICADO) Manipula a lógica de 'drop' no container.
     * @param {DragEvent} e - O evento nativo.
     * @param {Container} dropZone - A instância do Container.
     * @param {PanelGroup} draggedItem - O item sendo arrastado.
     * @param {DragDropService} dds - A instância do serviço de D&D.
     */
    handleDrop(e, dropZone, draggedItem, dds) {
        // 1. Obtém o índice de drop (será 'null' se a lógica 'ghost' anulou)
        const panelIndex = this._dropIndex;

        // 2. Limpa o feedback visual e o cache
        dds.hidePlaceholder();
        this.clearCache();

        // 3. Valida o drop
        if (!draggedItem || !(draggedItem instanceof PanelGroup) || panelIndex === null) {
            return; // Drop anulado (seja por erro ou pela lógica 'ghost')
        }

        const oldColumn = draggedItem.getColumn();

        // 4. Cria a nova coluna na lacuna (índice) encontrada
        const newColumn = dropZone.createColumn(null, panelIndex);

        // 5. Move o painel
        if (oldColumn) {
            oldColumn.removePanelGroup(draggedItem, true);
        }
        draggedItem.state.height = null; // Reseta a altura ao mover
        newColumn.addPanelGroup(draggedItem);
    }
}
