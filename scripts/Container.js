import { Column } from './Column/Column.js';
import { ColumnCreateArea } from './Column/ColumnCreateArea.js';
import { createPanel } from './Panel/PanelFactory.js';
import { appBus } from './EventBus.js';

export class Container {
    state = {
        // Estrutura: [CCA0, COL1, CCA1, COL2, CCA2, ...]
        children: []
    };

    draggedPanel = null;
    placeholder = null;

    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('panel-container');
        this.placeholder = document.createElement('div');
        this.placeholder.classList.add('panel-placeholder');
        this.clear();

        this.initEventListeners();
    }

    initEventListeners() {
        appBus.on('column:empty', this.onColumnEmpty.bind(this));
        appBus.on('panel:dragstart', this.onPanelDragStart.bind(this));
        appBus.on('panel:dragend', this.onPanelDragEnd.bind(this));
    }

    onColumnEmpty(column) {
        this.deleteColumn(column);
    }

    onPanelDragStart({ panel, event }) {
        this.startDrag(panel, event);
    }

    onPanelDragEnd() {
        this.endDrag();
    }

    startDrag(panel, e) {
        this.draggedPanel = panel;
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.dropEffect = 'move';
        panel.element.classList.add('dragging');
        this.placeholder.style.height = `${panel.element.offsetHeight}px`;
        e.dataTransfer.setDragImage(panel.element, 20, 20);
    }

    endDrag() {
        this.placeholder.remove();
        this.draggedPanel?.element.classList.remove('dragging');
        this.draggedPanel = null;
    }

    getDraggedPanel() {
        return this.draggedPanel;
    }

    getPlaceholder() {
        return this.placeholder;
    }

    /**
     * Atualiza as barras de redimensionamento de todas as colunas.
     */
    updateAllResizeBars() {
        const columns = this.getColumns();
        columns.forEach((column, idx) => {
            column.addResizeBars(idx === columns.length - 1); // Passa 'isLast'
        });
    }

    /**
     * Cria e insere um novo par [Column, ColumnCreateArea].
     * @param {number} width - A largura inicial.
     * @param {number | null} index - O índice do CCA que foi alvo. Se nulo, anexa ao final.
     */
    createColumn(width = null, index = null) {
        const column = new Column(this, width);
        const newCCA = new ColumnCreateArea(this);

        if (index === null) {
            // Caso 1: Adicionar do Menu ou Restaurar Estado
            // Anexa [COL, CCA] ao final do container.
            this.element.appendChild(column.element);
            this.element.appendChild(newCCA.element);
            this.state.children.push(column, newCCA);
        } else {
            // Caso 2: Soltar (Drop) em um CCA no `index`
            // Insere [COL, CCA] *após* o alvo, no `index + 1`.
            const insertionIndex = index + 1;
            const targetElement = this.element.children[insertionIndex] || null;

            if (targetElement) {
                this.element.insertBefore(column.element, targetElement);
                this.element.insertBefore(newCCA.element, targetElement);
            } else {
                this.element.appendChild(column.element);
                this.element.appendChild(newCCA.element);
            }
            this.state.children.splice(insertionIndex, 0, column, newCCA);
        }

        this.updateAllResizeBars();
        column.setParentContainer(this);
        this.updateColumnsSizes();
        return column;
    }

    /**
     * Exclui uma coluna e seu CCA subsequente.
     */
    deleteColumn(column) {
        const index = this.state.children.indexOf(column);
        if (index === -1) return;
        if (!(this.state.children[index] instanceof Column)) return;

        column.destroy();

        const columnEl = this.state.children[index].element;
        const createAreaEl = this.state.children[index + 1].element;
        if (columnEl) this.element.removeChild(columnEl);
        if (createAreaEl) this.element.removeChild(createAreaEl);
        this.state.children.splice(index, 2);
        column.setParentContainer(null);
        this.updateColumnsSizes();
        this.updateAllResizeBars();
    }

    getColumns() {
        return this.state.children.filter(c => c instanceof Column);
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
            column.updateWidth(idx === columns.length - 1); // Passa 'isLast'
        });
    }

    getState() {
        return this.getColumns().map(column => ({
            width: column.state.width,
            panels: column.state.panels.map(panel => ({
                type: panel.getPanelType(),
                title: panel.state.header.state.title,
                content: panel.state.content.element.innerHTML,
                height: panel.state.height,
                collapsed: panel.state.collapsed
            }))
        }));
    }

    restoreFromState(state) {
        this.clear(); // Começa com [CCA0]

        state.forEach(colData => {
            const column = this.createColumn(colData.width);

            colData.panels.forEach(panelData => {
                if (panelData.height === undefined || panelData.height === '') {
                    panelData.height = null;
                }
                const panel = createPanel(panelData);
                panel.setContent(panelData.content);
                panel.state.height = panelData.height;
                panel.state.collapsed = panelData.collapsed;
                panel.updateCollapse();
                column.addPanel(panel);
            });

            column.state.panels.forEach(panel => {
                panel.updateHeight();
            });
        });

        const columns = this.getColumns();
        columns.forEach((col, idx) => {
            if (idx < state.length - 1) {
                col.element.style.flex = `0 0 ${state[idx].width}px`;
            }
        });
    }

    /**
     * Limpa o container e adiciona o primeiro ColumnCreateArea.
     */
    clear() {
        this.element.innerHTML = '';
        this.state.children = [];

        // Inicia a estrutura com [CCA0]
        const columnCreateArea = new ColumnCreateArea(this);
        this.element.appendChild(columnCreateArea.element);
        this.state.children.push(columnCreateArea);
    }
}
