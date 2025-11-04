import { Column } from './Column/Column.js';
import { ColumnCreateArea } from './Column/ColumnCreateArea.js';
import { createPanelGroupFromState } from './Panel/PanelFactory.js';
import { appBus } from './EventBus.js';
import { DragDropService } from './Services/DND/DragDropService.js';

/**
 * Description:
 * O contêiner principal da aplicação. Gerencia o layout das Colunas (Column)
 * e das Áreas de Criação de Coluna (ColumnCreateArea).
 * Delega o estado de D&D ao DragDropService.
 *
 * Properties summary:
 * - state {object} : Gerencia os filhos (`[CCA, Col, CCA, ...]`).
 */
export class Container {
    state = {
        children: []
    };

    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('container');

        this.clear();
        this.initEventListeners();
    }

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
     * Cria e insere um novo par [Column, ColumnCreateArea].
     */
    createColumn(width = null, index = null) {
        const column = new Column(this, width);
        const newCCA = new ColumnCreateArea(this);

        if (index === null) {
            this.element.appendChild(column.element);
            this.element.appendChild(newCCA.element);
            this.state.children.push(column, newCCA);
        } else {
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
        this.updateColumnsSizes();
        this.updateAllResizeBars();
    }

    /**
     * Retorna todas as instâncias de Coluna.
     */
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
            column.updateWidth(idx === columns.length - 1);
        });
    }

    getState() {
        return this.getColumns().map(column => ({
            width: column.state.width,
            panelGroups: column.state.panelGroups.map(group => ({
                height: group.state.height,
                collapsed: group.state.collapsed,
                activePanelId: group.state.activePanel ? group.state.activePanel.id : null,
                panels: group.state.panels.map(panel => ({
                    id: panel.id,
                    type: panel.getPanelType(),
                    title: panel.state.title,
                    content: panel.state.content.element.innerHTML,
                    height: panel.state.height,
                    closable: panel.state.closable,
                    movable: panel.state.movable
                }))
            }))
        }));
    }

    restoreFromState(state) {
        this.clear();

        state.forEach(colData => {
            const column = this.createColumn(colData.width);
            const groupsToRestore = [];

            colData.panelGroups.forEach(groupData => {
                const group = createPanelGroupFromState(groupData);
                if (group) {
                    groupsToRestore.push(group);
                }
            });

            if (groupsToRestore.length > 0) {
                column.addPanelGroupsBulk(groupsToRestore);
            }
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

        const columnCreateArea = new ColumnCreateArea(this);
        this.element.appendChild(columnCreateArea.element);
        this.state.children.push(columnCreateArea);
    }
}
