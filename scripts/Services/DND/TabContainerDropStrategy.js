import { Panel } from '../../Panel/Panel.js';
import { DragDropService } from './DragDropService.js';

/**
 * Description:
 * Uma estratégia de D&D que define o comportamento de soltura
 * para o 'TabContainer' (o cabeçalho do PanelGroup).
 *
 * Esta estratégia SÓ aceita drops do tipo 'Panel' e
 * gere a lógica de mover a aba entre PanelGroups.
 */
export class TabContainerDropStrategy {
    /**
     * Helper privado para obter os grupos de origem e destino.
     * @param {{item: object, type: string}} draggedData
     * @param {HTMLElement} dropZone (O elemento tabContainer)
     * @returns {{draggedPanel: Panel, sourceGroup: PanelGroup, targetGroup: PanelGroup} | null}
     * @private
     */
    _getGroups(draggedData, dropZone) {
        // Valida o tipo de item arrastado
        if (
            !draggedData.item ||
            draggedData.type !== 'Panel' ||
            !(draggedData.item instanceof Panel)
        ) {
            return null;
        }

        const draggedPanel = draggedData.item;

        // O 'dropZone' é o 'tabContainer', que tem a referência de 'owner'
        const targetGroup = dropZone.panelGroupOwner;

        // O painel arrastado tem a referência do seu pai
        const sourceGroup = draggedPanel.state.parentGroup;

        if (!targetGroup || !sourceGroup) {
            return null;
        }

        return { draggedPanel, sourceGroup, targetGroup };
    }

    /**
     * Chamado quando o rato entra no tabContainer.
     * @param {DragEvent} e
     * @param {HTMLElement} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {DragDropService} dds
     */
    handleDragEnter(e, dropZone, draggedData, dds) {
        const groups = this._getGroups(draggedData, dropZone);

        // Se o item for inválido ou se for o mesmo grupo, não faz nada
        if (!groups || groups.sourceGroup === groups.targetGroup) {
            return;
        }

        // Esconde outros placeholders (horizontal/vertical)
        dds.hidePlaceholder();
        // Adiciona feedback visual
        dropZone.classList.add('panel-group__tab-container--droptarget');
    }

    /**
     * Chamado quando o rato se move sobre o tabContainer.
     * @param {DragEvent} e
     * @param {HTMLElement} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {DragDropService} dds
     */
    handleDragOver(e, dropZone, draggedData, dds) {
        const groups = this._getGroups(draggedData, dropZone);
        if (!groups || groups.sourceGroup === groups.targetGroup) {
            return;
        }

        // Mantém o feedback
        dds.hidePlaceholder();
        dropZone.classList.add('panel-group__tab-container--droptarget');
    }

    /**
     * Chamado quando o rato sai do tabContainer.
     * @param {DragEvent} e
     * @param {HTMLElement} dropZone
     */
    handleDragLeave(e, dropZone) {
        // Verifica se está apenas a entrar num filho (ex: botão de scroll)
        if (e.relatedTarget && dropZone.contains(e.relatedTarget)) {
            return;
        }
        // Limpa o feedback
        dropZone.classList.remove('panel-group__tab-container--droptarget');
    }

    /**
     * Chamado quando o 'Panel' é solto no tabContainer.
     * @param {DragEvent} e
     * @param {HTMLElement} dropZone
     * @param {{item: object, type: string}} draggedData
     */
    handleDrop(e, dropZone, draggedData) {
        // 1. Limpa o feedback
        dropZone.classList.remove('panel-group__tab-container--droptarget');

        // 2. Valida o drop
        const groups = this._getGroups(draggedData, dropZone);
        if (!groups || groups.sourceGroup === groups.targetGroup) {
            return;
        }

        const { draggedPanel, sourceGroup, targetGroup } = groups;

        // 3. Executa a lógica de negócio (Mover a aba)
        sourceGroup.removePanel(draggedPanel);
        targetGroup.addPanel(draggedPanel, true); // Adiciona e torna ativa
    }

    /**
     * Esta estratégia é 'stateless' (não guarda cache), mas
     * implementamos o clearCache para conformidade (limpa o feedback visual).
     */
    clearCache() {
        // Encontra todos os drop zones e limpa o feedback
        const zones = document.querySelectorAll('.panel-group__tab-container--droptarget');
        zones.forEach(zone => zone.classList.remove('panel-group__tab-container--droptarget'));
    }
}
