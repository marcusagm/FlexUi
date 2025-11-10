import { PanelGroup } from '../../components/Panel/PanelGroup.js'; // (NOVO) Importa PanelGroup
import { Panel } from '../../components/Panel/Panel.js';
import { DragDropService } from './DragDropService.js';

/**
 * Description:
 * Uma estratégia de D&D que define o comportamento de soltura
 * para o 'TabContainer' (o cabeçalho do PanelGroup).
 *
 * Esta estratégia SÓ aceita drops do tipo 'Panel' e
 * gere a lógica de mover a aba entre PanelGroups.
 *
 * (Refatorado vBugFix 5) Esta estratégia agora também aceita
 * 'PanelGroup', SE ele contiver apenas 1 painel,
 * "desembrulhando-o" para mesclar os grupos.
 */
export class TabContainerDropStrategy {
    /**
     * (MODIFICADO - BugFix 5) Helper privado para obter os grupos de origem e destino.
     * Agora aceita arrastar um 'Panel' (aba) ou um 'PanelGroup' (com 1 painel).
     *
     * @param {{item: object, type: string}} draggedData
     * @param {HTMLElement} dropZone (O elemento tabContainer)
     * @returns {{draggedPanel: Panel, sourceGroup: PanelGroup, targetGroup: PanelGroup} | null}
     * @private
     */
    _getGroups(draggedData, dropZone) {
        const targetGroup = dropZone.panelGroupOwner;
        if (!targetGroup) return null;

        let draggedPanel = null;
        let sourceGroup = null;

        // Valida o tipo de item arrastado
        if (!draggedData.item) {
            return null;
        }

        if (draggedData.type === 'Panel') {
            // --- Lógica Existente: Arrastando uma Aba (Panel) ---
            if (!(draggedData.item instanceof Panel)) return null;
            draggedPanel = draggedData.item;
            sourceGroup = draggedPanel.state.parentGroup;
        } else if (draggedData.type === 'PanelGroup') {
            // --- Lógica Nova: Arrastando um Grupo (PanelGroup) ---
            if (!(draggedData.item instanceof PanelGroup)) return null;

            // Só aceita o drop se o PanelGroup tiver EXATAMENTE 1 painel
            if (draggedData.item.state.panels.length === 1) {
                sourceGroup = draggedData.item;
                draggedPanel = sourceGroup.state.panels[0];
            } else {
                return null; // Recusa o drop (ex: arrastar um grupo com 3 abas)
            }
        } else {
            return null; // Tipo desconhecido
        }

        // Validação final
        if (!targetGroup || !sourceGroup || !draggedPanel) {
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
        // (Esta lógica agora funciona para ambos os casos, Panel ou PanelGroup)
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
