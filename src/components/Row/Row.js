import { Column } from '../Column/Column.js';
// (REMOVIDO) DragDropService não é mais importado aqui
import { appBus } from '../../utils/EventBus.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';

/**
 * Description:
 * (REFATORADO) Gere uma única Linha (Row) horizontal que contém Colunas.
 * Atua como uma "drop zone inteligente" (tipo 'row') para detetar
 * o drop nas "lacunas" (gaps) entre as colunas.
 * (Contexto 12) Agora também gere o redimensionamento vertical (altura).
 *
 * (Refatorado) A lógica de cálculo de layout (fills-space) foi movida
 * para o LayoutService. Este componente apenas emite 'layout:columns-changed'.
 *
 * (Refatorado vBugFix) Corrige o vazamento de listeners do appBus
 * armazenando as referências bindadas.
 *
 * (REFATORADO vDND-Bridge) Remove listeners DND locais e delega ao DragDropService
 * através de 'dataset.dropzone' e 'dropZoneInstance'.
 *
 * (CORREÇÃO vDND-Bug-Index) O método 'createColumn' agora usa
 * a lógica de 'state-based sibling lookup' (como sugerido pelo usuário)
 * para inserir a coluna no local DOM correto, ignorando
 * elementos não-componentes como 'row__resize-handle'.
 *
 * (CORREÇÃO vEventBus) Usa ID e namespace para listeners do appBus.
 */
export class Row {
    state = {
        children: [], // Contém instâncias de Column
        parentContainer: null, // (NOVO) Contexto 11
        height: null // (NOVO) Contexto 11
    };

    // (NOVO) ID único para namespace
    id = 'row_' + (Math.random().toString(36).substring(2, 9) + Date.now());

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

    /**
     * (NOVO) Armazena a referência bindada para o listener
     * @type {function | null}
     * @private
     */
    _boundOnColumnEmpty = null;

    constructor(container, height = null) {
        this.element = document.createElement('div');
        this.element.classList.add('row'); // (MODIFICADO) Contexto 11
        this.state.parentContainer = container; // (NOVO) Contexto 11
        this.state.height = height; // (NOVO) Contexto 11
        this.setMinHeight(this._minHeight); // (NOVO) Contexto 12

        this.dropZoneType = 'row'; // (MODIFICADO) Contexto 11

        // (MODIFICADO - Etapa 1)
        this.element.dataset.dropzone = this.dropZoneType;
        this.element.dropZoneInstance = this;
        // (REMOVIDO) initDNDListeners();

        // (NOVO) Contexto 12
        this.setThrottledUpdate(
            throttleRAF(() => {
                // Passa 'false' pois a sincronização O(N) é feita no 'onUp'
                this.updateHeight(false);
            })
        );

        // (NOVO) Define a referência bindada
        this._boundOnColumnEmpty = this.onColumnEmpty.bind(this);

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

    // (REMOVIDO - Etapa 1) Métodos initDNDListeners e handlers (onDrag...)

    /**
     * (MODIFICADO) Usa a referência bindada e adiciona namespace
     */
    initEventListeners() {
        appBus.on('column:empty', this._boundOnColumnEmpty, { namespace: this.id });
    }

    /**
     * (NOVO) Notifica o LayoutService que o layout das colunas mudou.
     */
    requestLayoutUpdate() {
        appBus.emit('layout:columns-changed', this);
    }

    /**
     * (MODIFICADO) Usa a referência bindada
     * (NOVO) Contexto 12: Limpeza de listeners e filhos
     * (MODIFICADO) Usa offByNamespace
     */
    destroy() {
        const me = this;
        // (INÍCIO DA MODIFICAÇÃO - Etapa 3)
        appBus.offByNamespace(me.id);
        // (FIM DA MODIFICAÇÃO)

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
     * (MODIFICADO - CORREÇÃO) Esta função agora é chamada apenas pelo LayoutService.
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
     * (MODIFICADO) 'onUp' agora chama 'requestLayoutUpdate' do container
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
            // (MODIFICADO) Delega ao LayoutService (via Container)
            container.requestLayoutUpdate(); // Sincroniza O(N)
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * Cria e insere uma nova Coluna.
     * (MODIFICADO - CORREÇÃO) Usa lógica de 'sibling lookup'
     */
    createColumn(width = null, index = null) {
        const column = new Column(this, width); // 'this' (Row) é o container da Coluna

        // (INÍCIO DA CORREÇÃO)
        if (index === null) {
            // Se o índice for nulo (fim da lista)
            this.state.children.push(column);

            // Insere ANTES do handle, ou no fim se não houver handle
            const resizeHandle = this.element.querySelector('.row__resize-handle');
            this.element.insertBefore(column.element, resizeHandle);
        } else {
            // Se o índice for um número (ex: 0 ou 1)

            // 1. Insere no array de estado
            this.state.children.splice(index, 0, column);

            // 2. Encontra o próximo irmão no *estado*
            const nextSiblingColumn = this.state.children[index + 1];

            // 3. Obtém o elemento DOM do próximo irmão
            let nextSiblingElement = nextSiblingColumn ? nextSiblingColumn.element : null;

            // 4. Se não houver próximo irmão (inserindo no fim),
            // devemos inserir antes do handle (se ele existir)
            if (!nextSiblingElement) {
                const resizeHandle = this.element.querySelector('.row__resize-handle');
                if (resizeHandle) {
                    nextSiblingElement = resizeHandle;
                }
            }

            // 5. Insere no DOM. Se nextSiblingElement for null,
            // 'insertBefore' age como 'appendChild'.
            this.element.insertBefore(column.element, nextSiblingElement);
        }
        // (FIM DA CORREÇÃO)

        // (REMOVIDO - CORREÇÃO) 'updateAllResizeBars' movido para LayoutService
        // this.updateAllResizeBars();
        column.setParentContainer(this); // O pai da Coluna é a Row
        // (MODIFICADO) Delega ao LayoutService
        this.requestLayoutUpdate();
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
        // (MODIFICADO) Delega ao LayoutService
        this.requestLayoutUpdate();
        // (REMOVIDO - CORREÇÃO) 'updateAllResizeBars' movido para LayoutService
        // this.updateAllResizeBars();
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

    /**
     * (REMOVIDO) updateColumnsSizes() foi movido para o LayoutService.
     */

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

        // (MODIFICADO) Delega ao LayoutService
        this.requestLayoutUpdate();
        // (REMOVIDO - CORREÇÃO) 'updateAllResizeBars' movido para LayoutService
        // this.updateAllResizeBars();
        this.updateHeight(false); // Assume que não é a última
    }
}
