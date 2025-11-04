import { appBus } from '../EventBus.js';
import { PanelGroup } from '../Panel/PanelGroup.js';
import { DragDropService } from '../Services/DragDropService.js';

/**
 * Description:
 * Manages a single vertical column in the container. It holds and organizes
 * PanelGroups, manages horizontal resizing, and handles the drag/drop
 * logic for reordering PanelGroups within itself or creating new ones when
 * a Panel (tab) is dropped onto it.
 *
 * Properties summary:
 * - state {object} : Internal state management.
 * - container {Container} : The parent Container instance.
 * - panelGroups {Array<PanelGroup>} : (Req 3.1) The list of PanelGroups this column holds.
 * - width {number|null} : The user-defined width of the column in pixels.
 * - _minWidth {number} : (Req 5) The minimum width the column can be resized to.
 *
 * Typical usage:
 * const column = new Column(myContainer);
 * const panelGroup = new PanelGroup(new TextPanel('Title'));
 * column.addPanelGroup(panelGroup);
 *
 * Notes / Additional:
 * - This class only contains PanelGroups.
 * - It emits 'column:empty' when its last PanelGroup is removed.
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
     * @param {Container} container - The parent container instance.
     * @param {number|null} [width=null] - The initial width of the column.
     */
    constructor(container, width = null) {
        this.minWidth = 150;
        this.state.container = container;
        this.state.width = width;

        this.element = document.createElement('div');
        this.element.classList.add('column');

        // ADICIONADO: Identificador de Drop Zone
        this.dropZoneType = 'column';

        this.initDragDrop();
        this.initEventListeners();
    }

    /**
     * @param {number} width
     */
    set minWidth(width) {
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
    get minWidth() {
        return this._minWidth;
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
        [...this.state.panelGroups].forEach(panel => panel.destroy());
    }

    /**
     * Sets the parent container reference.
     * @param {Container} container - The parent container instance.
     */
    setParentContainer(container) {
        this.state.container = container;
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
            me.state.width = Math.max(me.minWidth, startW + delta);
            container.updateColumnsSizes();
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
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
        }
        if (this.state.width !== null) {
            this.element.style.flex = `0 0 ${this.state.width}px`;
        }
        this.updatePanelGroupsSizes();
    }

    /**
     * Handles the dragover event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDragOver(e) {
        // ALTERADO: Delega ao serviço
        e.preventDefault();
        DragDropService.getInstance().handleDragOver(e, this);
    }

    /**
     * Handles the drop event by delegating to the DragDropService.
     * @param {DragEvent} e
     */
    onDrop(e) {
        // ALTERADO: Delega ao serviço
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

    updatePanelGroupsSizes() {
        const uncollapsedPanelGroups = this.getPanelGroupsUncollapsed();
        const lastUncollapsedPanelGroup = uncollapsedPanelGroups[uncollapsedPanelGroups.length - 1];

        this.state.panelGroups.forEach(panel => {
            panel.element.classList.remove('panel--fills-space');
        });

        if (lastUncollapsedPanelGroup) {
            lastUncollapsedPanelGroup.state.height = null;
        }

        this.state.panelGroups.forEach(panel => {
            panel.updateHeight();
        });

        if (lastUncollapsedPanelGroup && lastUncollapsedPanelGroup.state.height === null) {
            lastUncollapsedPanelGroup.element.classList.add('panel--fills-space');
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
     * (Req 8) Ensures at least one PanelGroup is visible.
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
