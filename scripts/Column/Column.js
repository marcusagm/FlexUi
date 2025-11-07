import { appBus } from '../EventBus.js';
import { PanelGroup } from '../Panel/PanelGroup.js';
import { DragDropService } from '../Services/DND/DragDropService.js';
import { throttleRAF } from '../ThrottleRAF.js';

/**
 * Description:
 * Manages a single vertical column in the container. It holds and organizes
 * PanelGroups, manages horizontal resizing, and delegates drag/drop logic.
 * (Refatorado) Agora delega a lógica de layout (fills-space, collapse rules)
 * para o LayoutService emitindo 'layout:changed'.
 *
 * Properties summary:
 * - state {object} : Internal state management.
 * - _minWidth {number} : The minimum width the column can be resized to.
 * - _throttledUpdate {function} : A versão throttled da função de update.
 *
 * Typical usage:
 * const column = new Column(myContainer);
 * const panelGroup = new PanelGroup(new TextPanel('Title'));
 * column.addPanelGroup(panelGroup);
 */
export class Column {
    /**
     * @type {object}
     * @private
     */
    state = {
        container: null,
        panelGroups: [],
        width: null
    };

    /**
     * The minimum width in pixels for horizontal resizing.
     * @type {number}
     * @private
     */
    _minWidth = 150;

    /**
     * A versão throttled (com rAF) da função de atualização.
     * @type {function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * @param {Container} container - The parent container instance.
     * @param {number|null} [width=null] - The initial width of the column.
     */
    constructor(container, width = null) {
        this.setMinWidth(this._minWidth);
        this.setParentContainer(container);
        this.state.width = width;

        this.element = document.createElement('div');
        this.element.classList.add('column');
        this.dropZoneType = 'column';

        // (MODIFICADO) A função throttled agora atualiza apenas o estilo O(1) desta coluna.
        // A atualização O(N) (container.updateColumnsSizes) é chamada apenas no 'onUp'.
        this.setThrottledUpdate(
            throttleRAF(() => {
                if (this.state.width !== null) {
                    this.element.style.flex = `0 0 ${this.state.width}px`;
                }
            })
        );

        this.initDragDrop();
        this.initEventListeners();
    }

    // --- Getters / Setters ---

    /**
     * @param {number} width
     */
    setMinWidth(width) {
        const sanitizedWidth = Number(width);
        if (isNaN(sanitizedWidth) || sanitizedWidth < 0) {
            console.warn(`Column: Invalid minWidth "${width}". Must be a non-negative number.`);
            this._minWidth = 0;
            return;
        }
        this._minWidth = sanitizedWidth;
    }

    /**
     * @returns {number}
     */
    getMinWidth() {
        return this._minWidth;
    }

    /**
     * Define a função de atualização throttled.
     * @param {function} throttledFunction
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * Obtém a função de atualização throttled.
     * @returns {function}
     */
    getThrottledUpdate() {
        return this._throttledUpdate;
    }

    /**
     * Sets the parent container reference.
     * @param {Container} container - The parent container instance.
     */
    setParentContainer(container) {
        if (!container) {
            console.warn('Column: setParentContainer received a null container.');
            return;
        }
        this.state.container = container;
    }

    // --- Concrete Methods ---

    /**
     * Initializes event listeners for the EventBus.
     */
    initEventListeners() {
        appBus.on('panelgroup:removed', this.onPanelGroupRemoved.bind(this));
    }

    /**
     * Handles the removal of a PanelGroup triggered by the EventBus.
     * @param {object} eventData - The event data.
     * @param {PanelGroup} eventData.panel - The PanelGroup instance being removed.
     * @param {Column} eventData.column - The Column it is being removed from.
     */
    onPanelGroupRemoved({ panel, column }) {
        if (column === this && panel instanceof PanelGroup) {
            this.removePanelGroup(panel, true);
        }
    }

    /**
     * Cleans up event listeners when the column is destroyed.
     */
    destroy() {
        appBus.off('panelgroup:removed', this.onPanelGroupRemoved.bind(this));
        this.getThrottledUpdate()?.cancel();

        [...this.state.panelGroups].forEach(panel => panel.destroy());
    }

    /**
     * Initializes native drag-and-drop event listeners for the column element.
     */
    initDragDrop() {
        this.element.addEventListener('dragenter', this.onDragEnter.bind(this));
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
        this.element.addEventListener('dragleave', this.onDragLeave.bind(this));
        this.element.addEventListener('drop', this.onDrop.bind(this));
    }

    /**
     * Adds the horizontal resize bar to the column.
     * @param {boolean} isLast - Indicates if this is the last column in the container.
     */
    addResizeBars(isLast) {
        this.element.querySelectorAll('.column__resize-handle').forEach(b => b.remove());
        this.element.classList.remove('column--resize-right');

        if (isLast) return;

        this.element.classList.add('column--resize-right');
        const bar = document.createElement('div');
        bar.classList.add('column__resize-handle');
        this.element.appendChild(bar);
        bar.addEventListener('mousedown', e => this.startResize(e));
    }

    /**
     * (MODIFICADO) Handles the start of a horizontal resize drag.
     * @param {MouseEvent} e - The mousedown event.
     */
    startResize(e) {
        const me = this;
        const container = me.state.container;

        const columns = container.getColumns(); // Usa o getter
        const cols = columns.map(c => c.element);

        const idx = cols.indexOf(me.element);
        if (cols.length === 1 || idx === cols.length - 1) return;

        e.preventDefault();
        const startX = e.clientX;
        const startW = me.element.offsetWidth;

        const onMove = ev => {
            const delta = ev.clientX - startX;
            me.state.width = Math.max(me.getMinWidth(), startW + delta);

            // Chama a função throttled (O(1))
            me.getThrottledUpdate()();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);

            // Cancela qualquer frame O(1) pendente
            me.getThrottledUpdate()?.cancel();

            // Chama a atualização O(N) uma única vez no final
            // para sincronizar todas as colunas (especialmente a última).
            container.updateColumnsSizes();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * Updates the CSS flex-basis (width) of the column.
     * @param {boolean} isLast - Indicates if this is the last column.
     */
    updateWidth(isLast) {
        if (isLast) {
            this.element.style.flex = `1 1 auto`;
        } else if (this.state.width !== null) {
            this.element.style.flex = `0 0 ${this.state.width}px`;
        }
        this.requestLayoutUpdate();
    }

    /**
     * Handles the dragenter event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDragEnter(e) {
        e.preventDefault();
        e.stopPropagation(); // (ADIÇÃO DA CORREÇÃO)
        DragDropService.getInstance().handleDragEnter(e, this);
    }

    /**
     * Handles the dragover event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDragOver(e) {
        e.preventDefault();
        e.stopPropagation(); // (ADIÇÃO DA CORREÇÃO)
        DragDropService.getInstance().handleDragOver(e, this);
    }

    /**
     * Handles the dragleave event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDragLeave(e) {
        e.preventDefault();
        e.stopPropagation(); // (ADIÇÃO DA CORREÇÃO)
        DragDropService.getInstance().handleDragLeave(e, this);
    }

    /**
     * Handles the drop event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDrop(e) {
        e.preventDefault();
        e.stopPropagation(); // (ADIÇÃO DA CORREÇÃO)
        DragDropService.getInstance().handleDrop(e, this);
    }

    /**
     * Adds multiple PanelGroups at once (used for state restoration).
     * @param {Array<PanelGroup>} panelGroups
     */
    addPanelGroupsBulk(panelGroups) {
        panelGroups.forEach(panelGroup => {
            this.state.panelGroups.push(panelGroup);
            this.element.appendChild(panelGroup.element);
            panelGroup.setParentColumn(this);
        });
        this.requestLayoutUpdate();
    }

    /**
     * Adds a single PanelGroup to the column at a specific index.
     * @param {number|null} [index=null]
     */
    addPanelGroup(panelGroup, index = null) {
        if (index === null) {
            this.state.panelGroups.push(panelGroup);
            this.element.appendChild(panelGroup.element);
        } else {
            this.state.panelGroups.splice(index, 0, panelGroup);
            const nextSiblingPanel = this.state.panelGroups[index + 1];
            const nextSiblingElement = nextSiblingPanel ? nextSiblingPanel.element : null;
            this.element.insertBefore(panelGroup.element, nextSiblingElement);
        }
        panelGroup.setParentColumn(this);
        this.requestLayoutUpdate();
    }

    /**
     * @returns {Array<PanelGroup>}
     */
    getPanelGroupsCollapsed() {
        return this.state.panelGroups.filter(p => p.state.collapsed);
    }

    /**
     * @returns {Array<PanelGroup>}
     */
    getPanelGroupsUncollapsed() {
        return this.state.panelGroups.filter(p => !p.state.collapsed);
    }

    /**
     * Getter público para o state de panelGroups (melhor encapsulamento).
     * @returns {Array<PanelGroup>}
     */
    getPanelGroups() {
        return this.state.panelGroups;
    }

    /**
     * Removes a PanelGroup from the column.
     * @param {boolean} [emitEmpty=true] - Whether to emit 'column:empty'.
     */
    removePanelGroup(panelGroup, emitEmpty = true) {
        const index = this.getPanelGroupIndex(panelGroup);
        if (index === -1) return;

        this.state.panelGroups.splice(index, 1);
        panelGroup.setParentColumn(null);

        if (this.element.contains(panelGroup.element)) {
            this.element.removeChild(panelGroup.element);
        }

        this.requestLayoutUpdate();

        if (emitEmpty && this.getTotalPanelGroups() === 0) {
            appBus.emit('column:empty', this);
        }
    }

    /**
     * Emite um evento para o LayoutService recalcular esta coluna.
     */
    requestLayoutUpdate() {
        if (this.state.container) {
            appBus.emit('layout:column-changed', this);
        }
    }

    /**
     * @param {PanelGroup} panelGroup
     * @returns {number}
     */
    getPanelGroupIndex(panelGroup) {
        return this.state.panelGroups.findIndex(p => p === panelGroup);
    }

    /**
     * @param {HTMLElement} element
     * @returns {number}
     */
    getPanelGroupIndexByElement(element) {
        const allChildren = Array.from(this.element.children);
        let panelIndex = 0;
        for (const child of allChildren) {
            if (child === element) {
                break;
            }
            if (
                this.state.panelGroups.some(p => p.element === child) &&
                child.classList.contains('panel-group')
            ) {
                panelIndex++;
            }
        }
        return panelIndex;
    }

    /**
     * @returns {number}
     */
    getTotalPanelGroups() {
        return this.state.panelGroups.length;
    }

    toJSON() {
        return {
            width: this.state.width,
            panelGroups: this.state.panelGroups
                .filter(group => group instanceof PanelGroup)
                .map(group => group.toJSON())
        };
    }

    /**
     * Restaura o estado da coluna E de seus PanelGroups filhos.
     * @param {object} data - O objeto de estado serializado.
     */
    fromJSON(data) {
        if (data.width !== undefined) {
            this.state.width = data.width;
        }

        const groupsToRestore = [];
        if (data.panelGroups && Array.isArray(data.panelGroups)) {
            data.panelGroups.forEach(groupData => {
                const group = new PanelGroup();
                group.fromJSON(groupData);
                groupsToRestore.push(group);
            });
        }

        if (groupsToRestore.length > 0) {
            this.addPanelGroupsBulk(groupsToRestore);
        }

        this.updateWidth(false);
    }
}
