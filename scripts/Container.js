import { Row } from './Row.js';
import { appBus } from './EventBus.js';
import { DragDropService } from './Services/DND/DragDropService.js';

/**
 * Description:
 * (NOVO) O contêiner principal da aplicação. Gere o layout vertical das Linhas (Row).
 * Atua como uma "drop zone inteligente" (tipo 'container') para detetar
 * o drop nas "lacunas" (gaps) verticaIS entre as Linhas.
 *
 * (Contexto 12) Agora também gere os handles de resize vertical (altura) das Rows.
 *
 * (Refatorado) A lógica de cálculo de layout (fills-space) foi movida
 * para o LayoutService. Este componente apenas emite 'layout:rows-changed'.
 *
 * (Refatorado vBugFix) Corrige o vazamento de listeners do appBus
 * armazenando as referências bindadas e implementando destroy().
 *
 * Properties summary:
 * - state {object} : Gerencia os filhos (instâncias de Row).
 */
export class Container {
    state = {
        children: [] // Contém instâncias de Row
    };

    /**
     * (NOVO) Armazena a referência bindada para o listener
     * @type {function | null}
     * @private
     */
    _boundOnRowEmpty = null;

    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('container'); // Usa a nova classe CSS .container

        this.dropZoneType = 'container'; // Novo drop zone type (para lacunas verticais)
        this.initDNDListeners();

        // (NOVO) Define a referência bindada
        this._boundOnRowEmpty = this.onRowEmpty.bind(this);

        this.clear();
        this.initEventListeners();
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
        // e.stopPropagation(); // Não necessário no nível superior
        DragDropService.getInstance().handleDragEnter(e, this);
    }
    onDragOver(e) {
        e.preventDefault();
        // e.stopPropagation();
        DragDropService.getInstance().handleDragOver(e, this);
    }
    onDragLeave(e) {
        e.preventDefault();
        // e.stopPropagation();
        DragDropService.getInstance().handleDragLeave(e, this);
    }
    onDrop(e) {
        e.preventDefault();
        // e.stopPropagation();
        DragDropService.getInstance().handleDrop(e, this);
    }

    /**
     * (MODIFICADO) Usa a referência bindada
     */
    initEventListeners() {
        // Ouve o evento emitido pela Row (Etapa 1)
        appBus.on('row:empty', this._boundOnRowEmpty);
    }

    /**
     * (NOVO) Limpa todos os listeners para permitir "teardown".
     */
    destroy() {
        const me = this;
        appBus.off('row:empty', me._boundOnRowEmpty);

        // Um container destruído também deve destruir seus filhos
        [...me.getRows()].forEach(row => row.destroy());
        me.element.remove();
    }

    /**
     * (NOVO) Notifica o LayoutService que o layout das linhas mudou.
     */
    requestLayoutUpdate() {
        appBus.emit('layout:rows-changed', this);
    }

    /**
     * Chamado quando a última coluna de uma Row é removida.
     */
    onRowEmpty(row) {
        this.deleteRow(row);
    }

    /**
     * (NOVO) Contexto 12: Atualiza as barras de redimensionamento de todas as linhas.
     * (Lógica adaptada do Row.js)
     */
    updateAllResizeBars() {
        const rows = this.getRows();
        rows.forEach((row, idx) => {
            row.addResizeBars(idx === rows.length - 1);
        });
    }

    /**
     * (NOVO) Cria e insere uma nova Linha (Row).
     * @param {number|null} [height=null]
     * @param {number|null} [index=null] - O índice exato na lista de linhas.
     * @returns {Row} A linha criada.
     */
    createRow(height = null, index = null) {
        const row = new Row(this, height); // Passa 'this' (Container) como pai

        if (index === null) {
            this.element.appendChild(row.element);
            this.state.children.push(row);
        } else {
            const targetElement = this.element.children[index] || null;
            if (targetElement) {
                this.element.insertBefore(row.element, targetElement);
            } else {
                this.element.appendChild(row.element);
            }
            this.state.children.splice(index, 0, row);
        }

        // (MODIFICADO) Delega ao LayoutService
        this.requestLayoutUpdate();
        this.updateAllResizeBars(); // (NOVO) Contexto 12
        return row;
    }

    /**
     * (NOVO) Exclui uma linha.
     * (MODIFICADO) Contexto 12: Simplificado para usar row.destroy()
     */
    deleteRow(row) {
        const index = this.state.children.indexOf(row);
        if (index === -1) return;

        const rowEl = row.element;
        row.destroy(); // (MODIFICADO) Contexto 12: Chama o destroy da Row

        // Remove DOM
        if (rowEl && this.element.contains(rowEl)) {
            this.element.removeChild(rowEl);
        }

        // Remove do estado
        this.state.children.splice(index, 1);

        // (MODIFICADO) Delega ao LayoutService
        this.requestLayoutUpdate();
        this.updateAllResizeBars(); // (NOVO) Contexto 12
    }

    /**
     * (NOVO) Retorna todas as instâncias de Linha.
     */
    getRows() {
        return this.state.children;
    }

    getTotalRows() {
        return this.getRows().length;
    }

    getFirstRow() {
        const rows = this.getRows();
        return rows[0] || this.createRow();
    }

    /**
     * (REMOVIDO) updateRowsHeights() foi movido para o LayoutService.
     */

    /**
     * (MODIFICADO) Limpa o container e todas as linhas filhas.
     */
    clear() {
        [...this.getRows()].forEach(row => {
            this.deleteRow(row);
        });

        this.element.innerHTML = '';
        this.state.children = [];
    }

    /**
     * (NOVO) Serializa o Container (lista de Rows).
     */
    toJSON() {
        return {
            rows: this.getRows().map(row => row.toJSON())
        };
    }

    /**
     * (NOVO) Desserializa o Container (lista de Rows).
     * Inclui retrocompatibilidade para layouts antigos (sem 'rows').
     */
    fromJSON(data) {
        this.clear();
        const rowsData = data.rows || [];

        if (rowsData.length === 0 && data.columns) {
            // (FALLBACK) Se o JSON antigo (só colunas) for carregado,
            // embrulha-o numa única linha.
            console.warn("Container: Carregando layout legado (sem 'rows'). Embrulhando numa Row.");
            const row = this.createRow(); // Cria uma row com height null (preenchimento)
            // Passa os dados antigos (data) para o fromJSON da Row
            row.fromJSON(data);
        } else {
            // Carrega as linhas
            rowsData.forEach(rowData => {
                const row = this.createRow(rowData.height);
                row.fromJSON(rowData);
            });
        }

        // Se após tudo não houver linhas, cria uma vazia
        if (this.getRows().length === 0) {
            this.createRow();
        }

        // (MODIFICADO) Delega ao LayoutService
        this.requestLayoutUpdate();
        this.updateAllResizeBars(); // (NOVO) Contexto 12
    }
}
