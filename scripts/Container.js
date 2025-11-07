import { Column } from './Column/Column.js';
// import { ColumnCreateArea } from './Column/ColumnCreateArea.js'; // REMOVIDO
import { appBus } from './EventBus.js';
import { DragDropService } from './Services/DND/DragDropService.js'; // ADICIONADO

/**
 * Description:
 * O contêiner principal da aplicação. Gerencia o layout das Colunas (Column).
 * Delega o estado de D&D ao DragDropService.
 *
 * (Refatorado vPlan) Agora atua como uma "drop zone inteligente" (tipo 'container')
 * para detetar o drop nas "lacunas" (gaps) entre as colunas,
 * eliminando a necessidade de ColumnCreateArea.
 *
 * Properties summary:
 * - state {object} : Gerencia os filhos (apenas `[Col, Col, ...]`).
 */
export class Container {
    state = {
        children: [] // (Simplificado - agora só contém Colunas)
    };

    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('container');

        // ADICIONADO: Identificador e listeners D&D
        this.dropZoneType = 'container';
        this.initDNDListeners();

        this.clear();
        this.initEventListeners();
    }

    // ADICIONADO: Listeners D&D
    initDNDListeners() {
        this.element.addEventListener('dragenter', this.onDragEnter.bind(this));
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
        this.element.addEventListener('dragleave', this.onDragLeave.bind(this));
        this.element.addEventListener('drop', this.onDrop.bind(this));
    }

    // ADICIONADO: Handlers D&D (delegam ao serviço)
    onDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        DragDropService.getInstance().handleDragEnter(e, this);
    }
    onDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        DragDropService.getInstance().handleDragOver(e, this);
    }
    onDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        DragDropService.getInstance().handleDragLeave(e, this);
    }
    onDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        DragDropService.getInstance().handleDrop(e, this);
    }
    // FIM DAS ADIÇÕES D&D

    initEventListeners() {
        appBus.on('column:empty', this.onColumnEmpty.bind(this));
    }

    onColumnEmpty(column) {
        this.deleteColumn(column);
    }

    /**
     * Atualiza as barras de redimensionamento de todas as colunas.
     */
    updateAllResizeBars() {
        const columns = this.getColumns();
        columns.forEach((column, idx) => {
            column.addResizeBars(idx === columns.length - 1);
        });
    }

    /**
     * (MODIFICADO) Cria e insere uma nova Coluna.
     * @param {number|null} [width=null]
     * @param {number|null} [index=null] - O índice exato na lista de colunas.
     */
    createColumn(width = null, index = null) {
        const column = new Column(this, width);

        // Lógica de CCA removida

        if (index === null) {
            this.element.appendChild(column.element);
            this.state.children.push(column); // Simplificado
        } else {
            // (MODIFICADO) O índice agora é direto
            const targetElement = this.element.children[index] || null;

            if (targetElement) {
                this.element.insertBefore(column.element, targetElement);
            } else {
                this.element.appendChild(column.element);
            }
            this.state.children.splice(index, 0, column); // Simplificado
        }

        this.updateAllResizeBars();
        column.setParentContainer(this);
        this.updateColumnsSizes();
        return column;
    }

    /**
     * (MODIFICADO) Exclui uma coluna.
     */
    deleteColumn(column) {
        const index = this.state.children.indexOf(column);
        if (index === -1) return;
        if (!(this.state.children[index] instanceof Column)) return;

        column.destroy();

        const columnEl = this.state.children[index].element;
        // Lógica de CCA removida

        // (CORREÇÃO BUG 3.1) - (Mantida)
        if (columnEl && this.element.contains(columnEl)) {
            this.element.removeChild(columnEl);
        }
        // Remoção do createAreaEl removida

        this.state.children.splice(index, 1); // (MODIFICADO de 2 para 1)
        this.updateColumnsSizes();
        this.updateAllResizeBars();
    }

    /**
     * (MODIFICADO) Retorna todas as instâncias de Coluna.
     */
    getColumns() {
        // (MODIFICADO) Como 'children' agora só tem colunas,
        // podemos retornar diretamente, o que é mais eficiente.
        return this.state.children;
    }

    getTotalColumns() {
        return this.getColumns().length;
    }

    getFirstColumn() {
        const columns = this.getColumns();
        return columns[0] || this.createColumn();
    }

    getLastColumn() {
        const columns = this.getColumns();
        return columns[columns.length - 1] || this.createColumn();
    }

    /**
     * Atualiza a largura de todas as colunas.
     */
    updateColumnsSizes() {
        const columns = this.getColumns();
        columns.forEach((column, idx) => {
            column.updateWidth(idx === columns.length - 1);
        });
    }

    /**
     * (MODIFICADO) Limpa o container.
     */
    clear() {
        this.element.innerHTML = '';
        this.state.children = [];
        // Lógica de CCA removida
    }

    toJSON() {
        return {
            // getColumns() agora é mais eficiente
            columns: this.getColumns().map(column => column.toJSON())
        };
    }

    fromJSON(data) {
        this.clear(); // (Agora limpa 100%)

        const columnsData = data.columns || [];

        columnsData.forEach(colData => {
            // (MODIFICADO) O índice não é mais necessário aqui,
            // pois createColumn(null, null) adiciona ao fim,
            // o que é o comportamento correto na hidratação.
            const column = this.createColumn();
            column.fromJSON(colData);
        });
        this.updateColumnsSizes();
        this.updateAllResizeBars();
    }
}
