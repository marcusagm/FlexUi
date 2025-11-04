import { PanelGroup } from '../Panel/PanelGroup.js';
import { DragDropService } from '../Services/DND/DragDropService.js';

/**
 * Description:
 * Gerencia as zonas de drop finas entre as colunas, usadas para criar novas colunas.
 *
 * Properties summary:
 * - state {object} : Gerenciamento de estado interno.
 * - container {Container} : A instância do Container pai.
 *
 * Notes / Additional:
 * - Esta classe agora (Req 4.7) escuta apenas o drop de PanelGroups.
 */
export class ColumnCreateArea {
    state = {
        container: null
    };

    constructor(container) {
        this.state.container = container;
        this.element = document.createElement('div');
        this.element.classList.add('container__drop-area');

        // ADICIONADO: Identificador de Drop Zone
        this.dropZoneType = 'create-area';

        this.initDragDrop();
    }

    initDragDrop() {
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
        this.element.addEventListener('dragleave', this.onDragLeave.bind(this));
        this.element.addEventListener('drop', this.onDrop.bind(this));
    }

    /**
     * Handles the dragover event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDragOver(e) {
        // ALTERADO: Delega ao serviço
        e.preventDefault();
        DragDropService.getInstance().handleDragOver(e, this);
    }

    /**
     * Handles the dragleave event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDragLeave(e) {
        // ALTERADO: Delega ao serviço
        e.preventDefault();
        DragDropService.getInstance().handleDragLeave(e, this);
    }

    /**
     * Handles the drop event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDrop(e) {
        // ALTERADO: Delega ao serviço
        e.preventDefault();
        DragDropService.getInstance().handleDrop(e, this);
    }
}
