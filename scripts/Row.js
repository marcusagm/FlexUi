import { Column } from './Column/Column.js';
import { appBus } from './EventBus.js';
import { DragDropService } from './Services/DND/DragDropService.js';
import { throttleRAF } from './ThrottleRAF.js'; // (NOVO) Contexto 12

/**
 * Description:
 * (REFATORADO) Gere uma única Linha (Row) horizontal que contém Colunas.
 * Atua como uma "drop zone inteligente" (tipo 'row') para detetar
 * o drop nas "lacunas" (gaps) entre as colunas.
 * (Contexto 12) Agora também gere o redimensionamento vertical (altura).
 */
export class Row {
    state = {
        children: [], // Contém instâncias de Column
        parentContainer: null, // (NOVO) Contexto 11
        height: null // (NOVO) Contexto 11
    };

    /**
     * (NOVO) Contexto 12
     * @type {number}
     * @private
     */
    _minHeight = 100; // Altura mínima de 100px para uma linha

    /**
     * (NOVO) Contexto 12
     * @type {function | null}
     * @private
     */
    _throttledUpdate = null;

    constructor(container, height = null) {
        this.element = document.createElement('div');
        this.element.classList.add('row'); // (MODIFICADO) Contexto 11
        this.state.parentContainer = container; // (NOVO) Contexto 11
        this.state.height = height; // (NOVO) Contexto 11
        this.setMinHeight(this._minHeight); // (NOVO) Contexto 12

        this.dropZoneType = 'row'; // (MODIFICADO) Contexto 11
        this.initDNDListeners();

        // (NOVO) Contexto 12
        this.setThrottledUpdate(
            throttleRAF(() => {
                // Passa 'false' pois a sincronização O(N) é feita no 'onUp'
                this.updateHeight(false);
            })
        );

        this.clear();
        this.initEventListeners();
        this.updateHeight(false); // (MODIFICADO) Contexto 11/12
    }

    // --- Getters / Setters (Contexto 12) ---
    setMinHeight(height) {
        const sanitizedHeight = Number(height);
        if (isNaN(sanitizedHeight) || sanitizedHeight < 0) {
            this._minHeight = 0;
            return;
        }
        this._minHeight = sanitizedHeight;
    }
    getMinHeight() {
        return this._minHeight;
    }
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }
    getThrottledUpdate() {
        return this._throttledUpdate;
    }
    setParentContainer(container) {
        this.state.parentContainer = container;
    }
    // --- Fim Getters / Setters ---

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
     * (NOVO) Contexto 12: Limpeza de listeners e filhos
     */
    destroy() {
        const me = this;
        appBus.off('column:empty', this.onColumnEmpty.bind(me));
        me.getThrottledUpdate()?.cancel();

        // Destrói todas as colunas filhas
        [...me.getColumns()].forEach(column => column.destroy());
    }

    /**
     * (MODIFICADO) Contexto 11
     */
    onColumnEmpty(column) {
        this.deleteColumn(column);

        if (this.getTotalColumns() === 0 && this.state.parentContainer) {
            appBus.emit('row:empty', this); // Notifica o Container (pai)
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
     * (NOVO) Contexto 12: Adiciona o handle de resize vertical
     * @param {boolean} isLast - Se é a última linha no container
     */
    addResizeBars(isLast) {
        this.element.querySelectorAll('.row__resize-handle').forEach(b => b.remove());
        this.element.classList.remove('row--resize-bottom');

        if (isLast) return;

        this.element.classList.add('row--resize-bottom');
        const bar = document.createElement('div');
        bar.classList.add('row__resize-handle'); // (CSS na Etapa 3)
        this.element.appendChild(bar);
        bar.addEventListener('mousedown', e => this.startResize(e));
    }

    /**
     * (NOVO) Contexto 12: Lógica de resize vertical
     * @param {MouseEvent} e
     */
    startResize(e) {
        const me = this;
        const container = me.state.parentContainer;
        if (!container) return;

        const rows = container.getRows();
        const idx = rows.indexOf(me);
        if (rows.length === 1 || idx === rows.length - 1) return;

        e.preventDefault();
        const startY = e.clientY;
        const startH = me.element.offsetHeight;

        const onMove = ev => {
            const delta = ev.clientY - startY;
            me.state.height = Math.max(me.getMinHeight(), startH + delta);
            me.getThrottledUpdate()(); // Atualiza O(1)
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            me.getThrottledUpdate()?.cancel();
            container.updateRowsHeights(); // Sincroniza O(N)
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * Cria e insere uma nova Coluna.
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
        column.setParentContainer(this); // O pai da Coluna é a Row
        this.updateColumnsSizes();
        return column;
    }

    /**
     * Exclui uma coluna.
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

    updateColumnsSizes() {
        const columns = this.getColumns();
        columns.forEach((column, idx) => {
            column.updateWidth(idx === columns.length - 1);
        });
    }

    /**
     * (MODIFICADO) Contexto 11/12: Atualiza a altura CSS desta linha.
     * @param {boolean} isLast - Se esta linha é a última.
     */
    updateHeight(isLast) {
        if (isLast) {
            this.element.style.flex = `1 1 auto`;
            this.state.height = null; // Garante que a última linha sempre preenche
        } else if (this.state.height !== null) {
            this.element.style.flex = `0 0 ${this.state.height}px`;
        } else {
            // Se não for a última e não tiver altura,
            // comporta-se como 'fills-space'
            this.element.style.flex = `1 1 auto`;
        }
    }

    clear() {
        this.element.innerHTML = '';
        this.state.children = [];
    }

    /**
     * (MODIFICADO) Contexto 11
     */
    toJSON() {
        return {
            height: this.state.height,
            columns: this.getColumns().map(column => column.toJSON())
        };
    }

    /**
     * (MODIFICADO) Contexto 11
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
        this.updateHeight(false); // Assume que não é a última
    }
}
