import Panel from './Panel/Panel.js';
import Column from './Column/Column.js';
import ColumnCreateArea from './Column/ColumnCreateArea.js';

class Container {
    state = {
        columns: [],
        columnCreateAreas: []
    };

    constructor() {
        this.element = document.createElement('div');
        this.element.classList.add('panel-container');
        this.state.columns = [];

        const columnCreateArea = new ColumnCreateArea(this);
        this.element.appendChild(columnCreateArea.element);
        this.state.columnCreateAreas.push(columnCreateArea);
    }

    addColumn(column, index = null) {
        const columnCreateArea = new ColumnCreateArea(this);

        if (index === null) {
            this.state.columns.push(column);
            this.state.columnCreateAreas.push(columnCreateArea);

            this.element.appendChild(column.element);
            this.element.appendChild(columnCreateArea.element);
        } else {
            this.state.columns.splice(index, 0, column);
            this.state.columnCreateAreas.splice(index, 0, columnCreateArea);

            this.element.insertBefore(column.element, this.element.children[index + 1]);
            this.element.insertBefore(columnCreateArea.element, this.element.children[index + 2]);
        }

        this.state.columns.forEach(c => c.addResizeBars());
        column.setParentContainer(this);
        this.updateColumnsSizes();
    }

    createColumn(width = null, index = null) {
        const column = new Column(this, width);
        this.addColumn(column, index);
        return column;
    }

    deleteColumn(column) {
        const index = this.getColumnsIndex(column);

        this.element.removeChild(column.element);
        this.element.removeChild(this.state.columnCreateAreas[index + 1].element);

        this.state.columns.splice(index, 1);
        this.state.columnCreateAreas.splice(index, 1);

        column.setParentContainer(null);
        this.updateColumnsSizes();
    }

    getColumns() {
        return this.state.columns;
    }

    getTotalColumns() {
        return this.state.columns.length;
    }

    getFirstColumn() {
        return this.state.columns[0] || this.createColumn();
    }

    getLastColumn() {
        return this.state.columns[this.getTotalColumns - 1] || this.createColumn();
    }

    getColumnsIndex(column) {
        return this.state.columns.findIndex(c => c === column);
    }

    getColumnCreateAreaIndex(columnCreateArea) {
        return this.state.columnCreateAreas.findIndex(c => c === columnCreateArea);
    }

    getColumnCreateAreaPosition(columnCreateArea) {
        const children = Array.from(this.element.children);
        return children.findIndex(c => c === columnCreateArea.element);
    }

    updateColumnsSizes() {
        this.state.columns.forEach(column => {
            column.updateWidth();
        });
    }

    getState() {
        return this.state.columns.map(column => ({
            width: column.state.width,
            panels: column.state.panels.map(panel => ({
                title: panel.state.header.state.title,
                content: panel.state.content.element.innerHTML,
                height: panel.state.height,
                collapsed: panel.state.collapsed
            }))
        }));
    }

    restoreFromState(state) {
        this.clear();

        // console.log(state);
        state.forEach(colData => {
            const column = this.createColumn(colData.width);
            const idx = state.findIndex(c => c === colData);
            if (idx < state.length - 1) {
                column.element.style.flex = `0 0 ${colData.width}px`;
                // column.updateWidth();
            }
            colData.panels.forEach(panelData => {
                if (panelData.height === undefined || panelData.height === '') {
                    panelData.height = null;
                }
                const panel = new Panel(
                    panelData.title,
                    panelData.content,
                    panelData.height,
                    panelData.collapsed
                );
                column.addPanel(panel);
            });

            column.state.panels.forEach(panel => {
                panel.updateHeight();
            });
        });
    }

    clear() {
        this.element.innerHTML = '';
        this.element.columns = [];
        this.state.columns = [];
        this.state.columnCreateAreas = [];

        const columnCreateArea = new ColumnCreateArea(this);
        this.element.appendChild(columnCreateArea.element);
        this.state.columnCreateAreas.push(columnCreateArea);
    }
}

export default Container;
