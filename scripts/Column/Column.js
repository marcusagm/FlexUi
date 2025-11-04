import { appBus } from '../EventBus.js';
import { PanelGroup } from '../Panel/PanelGroup.js';
import { DragDropService } from '../Services/DND/DragDropService.js';
import { throttleRAF } from '../ThrottleRAF.js'; // 1. IMPORTAR

/**
 * Description:
 * Manages a single vertical column in the container. It holds and organizes
 * PanelGroups, manages horizontal resizing, and delegates drag/drop logic.
 *
 * Properties summary:
 * - state {object} : Internal state management.
 * - _minWidth {number} : The minimum width the column can be resized to.
 * - _throttledUpdate {function} : (NOVO) A versão throttled da função de update.
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
    _minWidth;

    /**
     * (NOVO) A versão throttled (com rAF) da função de atualização.
     * @type {function | null}
     * @private
     */
    _throttledUpdate = null;

    /**
     * @param {Container} container - The parent container instance.
     * @param {number|null} [width=null] - The initial width of the column.
     */
    constructor(container, width = null) {
        this.setMinWidth(150); // Padrão
        this.setParentContainer(container); // Define o container
        this.state.width = width;

        this.element = document.createElement('div');
        this.element.classList.add('column');
        this.dropZoneType = 'column'; // Identificador para DND

        // 2. INICIALIZAR O THROTTLE
        // Criamos a função throttled uma vez e a reutilizamos.
        // Ligamos (bind) o 'this.state.container' para garantir o contexto correto.
        this.setThrottledUpdate(
            throttleRAF(this.state.container.updateColumnsSizes.bind(this.state.container))
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
     * (NOVO) Define a função de atualização throttled.
     * @param {function} throttledFunction
     */
    setThrottledUpdate(throttledFunction) {
        this._throttledUpdate = throttledFunction;
    }

    /**
     * (NOVO) Obtém a função de atualização throttled.
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
        // Cancela qualquer frame de animação pendente
        this.getThrottledUpdate()?.cancel();

        [...this.state.panelGroups].forEach(panel => panel.destroy());
    }

    /**
     * Initializes native drag-and-drop event listeners for the column element.
     */
    initDragDrop() {
        this.element.addEventListener('dragover', this.onDragOver.bind(this));
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
     * Handles the start of a horizontal resize drag.
     * @param {MouseEvent} e - The mousedown event.
     */
    startResize(e) {
        const me = this;
        const container = me.state.container;

        const columns = container.state.children.filter(c => c instanceof Column);
        const cols = columns.map(c => c.element);

        const idx = cols.indexOf(me.element);
        if (cols.length === 1 || idx === cols.length - 1) return;

        e.preventDefault();
        const startX = e.clientX;
        const startW = me.element.offsetWidth;

        const onMove = ev => {
            const delta = ev.clientX - startX;
            me.state.width = Math.max(me.getMinWidth(), startW + delta);

            // 3. APLICAR O THROTTLE
            // Em vez de chamar container.updateColumnsSizes() diretamente...
            me.getThrottledUpdate()();
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);

            // 4. LIMPAR E GARANTIR O ESTADO FINAL
            // Cancela qualquer frame pendente...
            me.getThrottledUpdate()?.cancel();
            // E executa uma atualização final para garantir que o último
            // estado de 'width' seja aplicado.
            container.updateColumnsSizes();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    /**
     * (ATUALIZADO - Correção de Bug)
     * Updates the CSS flex-basis (width) of the column.
     * @param {boolean} isLast - Indicates if this is the last column.
     */
    updateWidth(isLast) {
        if (isLast) {
            this.element.style.flex = `1 1 auto`;
        } else if (this.state.width !== null) {
            this.element.style.flex = `0 0 ${this.state.width}px`;
        }
        // (A chamada de updatePanelGroupsSizes permanece, pois é necessária
        // para atualizar os botões de scroll das abas)
        this.updatePanelGroupsSizes();
    }

    /**
     * Handles the dragover event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDragOver(e) {
        e.preventDefault();
        DragDropService.getInstance().handleDragOver(e, this);
    }

    /**
     * Handles the drop event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDrop(e) {
        e.preventDefault();
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
        this.checkPanelsGroupsCollapsed();
        this.updatePanelGroupsSizes();
    }

    /**
     * Adds a single PanelGroup to the column at a specific index.
     * @param {PanelGroup} panelGroup
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
        this.checkPanelsGroupsCollapsed();
        this.updatePanelGroupsSizes();
    }

    /**
     * Recalcula os tamanhos (flex) de todos os PanelGroups filhos.
     */
    updatePanelGroupsSizes() {
        const uncollapsedPanelGroups = this.getPanelGroupsUncollapsed();
        const lastUncollapsedPanelGroup = uncollapsedPanelGroups[uncollapsedPanelGroups.length - 1];

        this.state.panelGroups.forEach(panel => {
            panel.element.classList.remove('panel-group--fills-space');
        });

        if (lastUncollapsedPanelGroup) {
            lastUncollapsedPanelGroup.state.height = null;
        }

        this.state.panelGroups.forEach(panel => {
            panel.updateHeight();
        });

        if (lastUncollapsedPanelGroup && lastUncollapsedPanelGroup.state.height === null) {
            lastUncollapsedPanelGroup.element.classList.add('panel-group--fills-space');
        }
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
     * Ensures at least one PanelGroup is visible.
     */
    checkPanelsGroupsCollapsed() {
        const uncollapsed = this.getPanelGroupsUncollapsed().length;
        const total = this.getTotalPanelGroups();

        if (uncollapsed === 0 && total > 0) {
            this.state.panelGroups[total - 1].unCollapse();
        }
    }

    /**
     * Removes a PanelGroup from the column.
     * @param {PanelGroup} panelGroup
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

        this.checkPanelsGroupsCollapsed();
        this.updatePanelGroupsSizes();

        if (emitEmpty && this.getTotalPanelGroups() === 0) {
            appBus.emit('column:empty', this);
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
            if (this.state.panelGroups.some(p => p.element === child) && child.classList.contains('panel-group')) {
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
}

