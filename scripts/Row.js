import { Column } from './Column/Column.js';
import { appBus } from './EventBus.js';
import { DragDropService } from './Services/DND/DragDropService.js';

/**
 * Description:
 * (REFATORADO) Gere uma única Linha (Row) horizontal que contém Colunas.
 * Atua como uma "drop zone inteligente" (tipo 'row') para detetar
 * o drop nas "lacunas" (gaps) entre as colunas.
 *
 * Properties summary:
 * - state {object} : Gerencia os filhos (apenas `[Col, Col, ...]`).
 */
export class Row {
    state = {
        children: [], // (Simplificado - agora só contém Colunas)
        parentContainer: null, // (NOVO) Referência ao Container pai
        height: null // (NOVO) Altura da linha (para resize vertical futuro)
    };

    constructor(container, height = null) {
        this.element = document.createElement('div');
        this.element.classList.add('row'); // (MODIFICADO) CSS class
        this.state.parentContainer = container;
        this.state.height = height;

        this.dropZoneType = 'row'; // (MODIFICADO) Drop zone type
        this.initDNDListeners();

        this.clear();
        this.initEventListeners();
        this.updateHeight();
    }

    // Listeners D&D (delegam ao serviço)
    initDNDListeners() {
        this.element.addEventListener('dragenter', this.onDragEnter.bind(this));
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
        this.element.addEventListener('dragleave', this.onDragLeave.bind(this));
        this.element.addEventListener('drop', this.onDrop.bind(this));
    }
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

    initEventListeners() {
        appBus.on('column:empty', this.onColumnEmpty.bind(this));
    }

    /**
     * (MODIFICADO) Chamado quando a última coluna é removida.
     * Notifica o Container (pai) se a linha ficar vazia.
     */
    onColumnEmpty(column) {
        this.deleteColumn(column);

        // (NOVO) Notifica o Container se esta linha ficar vazia
        if (this.getTotalColumns() === 0 && this.state.parentContainer) {
            appBus.emit('row:empty', this);
        }
    }

    /**
     * Atualiza as barras de redimensionamento de todas as colunas.
     * (Lógica inalterada)
     */
    updateAllResizeBars() {
        const columns = this.getColumns();
        columns.forEach((column, idx) => {
            column.addResizeBars(idx === columns.length - 1);
        });
    }

    /**
     * Cria e insere uma nova Coluna.
     * (Lógica de gestão de 'children' inalterada)
     */
    createColumn(width = null, index = null) {
        const column = new Column(this, width); // 'this' (Row) é o container da Coluna

        if (index === null) {
            this.element.appendChild(column.element);
            this.state.children.push(column);
        } else {
            const targetElement = this.element.children[index] || null;
            if (targetElement) {
                this.element.insertBefore(column.element, targetElement);
            } else {
                this.element.appendChild(column.element);
            }
            this.state.children.splice(index, 0, column);
        }

        this.updateAllResizeBars();
        // (MODIFICADO) O 'parent container' da Coluna é a 'Row'
        column.setParentContainer(this);
        this.updateColumnsSizes();
        return column;
    }

    /**
     * Exclui uma coluna.
     * (Lógica inalterada)
     */
    deleteColumn(column) {
        const index = this.state.children.indexOf(column);
        if (index === -1) return;
        if (!(this.state.children[index] instanceof Column)) return;

        column.destroy();
        const columnEl = this.state.children[index].element;
        if (columnEl && this.element.contains(columnEl)) {
            this.element.removeChild(columnEl);
        }
        this.state.children.splice(index, 1);
        this.updateColumnsSizes();
        this.updateAllResizeBars();
    }

    /**
     * Retorna todas as instâncias de Coluna.
     * (Lógica inalterada)
     */
    getColumns() {
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
     * (Lógica inalterada)
     */
    updateColumnsSizes() {
        const columns = this.getColumns();
        columns.forEach((column, idx) => {
            column.updateWidth(idx === columns.length - 1);
        });
    }

    /**
     * (NOVO) Atualiza a altura CSS desta linha.
     */
    updateHeight() {
        if (this.state.height !== null) {
            this.element.style.flex = `0 0 ${this.state.height}px`;
        } else {
            this.element.style.flex = `1 1 auto`;
        }
    }

    clear() {
        this.element.innerHTML = '';
        this.state.children = [];
    }

    /**
     * (MODIFICADO) Serializa esta Linha (altura e colunas).
     */
    toJSON() {
        return {
            height: this.state.height,
            columns: this.getColumns().map(column => column.toJSON())
        };
    }

    /**
     * (MODIFICADO) Desserializa esta Linha (altura e colunas).
     */
    fromJSON(data) {
        this.clear();

        if (data.height !== undefined) {
            this.state.height = data.height;
        }

        const columnsData = data.columns || [];

        columnsData.forEach(colData => {
            const column = this.createColumn();
            column.fromJSON(colData);
        });

        this.updateColumnsSizes();
        this.updateAllResizeBars();
        this.updateHeight();
    }
}
