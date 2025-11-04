import { appBus } from '../EventBus.js';
import { PanelGroup } from '../Panel/PanelGroup.js';

/**
 * Description:
 * Manages the global state and logic for drag-and-drop (D&D) operations.
 * It listens to appBus events, holds the dragged item state, and now also
 * contains the logic for handling drop targets (Drop Zones).
 *
 * This is implemented as a Singleton.
 *
 * Properties summary:
 * - _draggedItem {PanelGroup | null} : The actual PanelGroup instance being dragged.
 * - _placeholder {HTMLElement} : The shared DOM element used to show drop locations.
 * - _isDragging {boolean} : Flag indicating if a D&D operation is active.
 *
 * Typical usage:
 * // In App.js (to initialize):
 * DragDropService.getInstance();
 *
 * // In Drop Zones (e.g., Column.js):
 * onDragOver(e) {
 * e.preventDefault();
 * DragDropService.getInstance().handleDragOver(e, this); // 'this' is the dropZone
 * }
 */
export class DragDropService {
    /**
     * @type {DragDropService | null}
     * @private
     */
    static _instance = null;

    /**
     * @type {import('../Panel/PanelGroup.js').PanelGroup | null}
     * @private
     */
    _draggedItem = null;

    /**
     * @type {HTMLElement}
     * @private
     */
    _placeholder = null;

    /**
     * @type {boolean}
     * @private
     */
    _isDragging = false;

    /**
     * Private constructor for Singleton pattern.
     * @private
     */
    constructor() {
        if (DragDropService._instance) {
            console.warn('DragDropService instance already exists. Use getInstance().');
            return DragDropService._instance;
        }
        DragDropService._instance = this;

        this._createPlaceholder();
        this._initEventListeners();
    }

    /**
     * Gets the single instance of the service.
     * @returns {DragDropService}
     */
    static getInstance() {
        if (!DragDropService._instance) {
            DragDropService._instance = new DragDropService();
        }
        return DragDropService._instance;
    }

    // --- API Pública ---

    /**
     * Returns the PanelGroup instance currently being dragged.
     * @returns {import('../Panel/PanelGroup.js').PanelGroup | null}
     */
    getDraggedItem() {
        return this._draggedItem;
    }

    /**
     * Returns the shared placeholder DOM element.
     * @returns {HTMLElement}
     */
    getPlaceholder() {
        return this._placeholder;
    }

    /**
     * Checks if a drag operation is currently in progress.
     * @returns {boolean}
     */
    isDragging() {
        return this._isDragging;
    }

    /**
     * Handles the logic for a drag operation moving over a drop zone.
     * (Lógica movida de Column.js e ColumnCreateArea.js)
     * @param {DragEvent} e - The native drag event.
     * @param {Column | ColumnCreateArea} dropZone - The drop zone instance (this).
     */
    handleDragOver(e, dropZone) {
        const draggedItem = this.getDraggedItem();
        const placeholder = this.getPlaceholder();
        if (!draggedItem) return;

        // Lógica comum: remover placeholder de qualquer outro lugar
        placeholder.remove();

        // Lógica específica da Drop Zone
        if (dropZone.dropZoneType === 'column') {
            // Lógica copiada de Column.onDragOver
            if (draggedItem instanceof PanelGroup) {
                const oldColumn = draggedItem.state.column;
                const originalIndex = oldColumn ? oldColumn.getPanelGroupIndex(draggedItem) : -1;

                let placed = false;
                let dropIndex = dropZone.state.panelGroups.length;

                for (let i = 0; i < dropZone.state.panelGroups.length; i++) {
                    const targetGroup = dropZone.state.panelGroups[i];
                    const targetElement = targetGroup.element;
                    const rect = targetElement.getBoundingClientRect();

                    if (draggedItem === targetGroup) continue;

                    if (e.clientY < rect.top + rect.height / 2) {
                        dropZone.element.insertBefore(placeholder, targetElement);
                        placed = true;
                        dropIndex = i;
                        break;
                    }
                }
                if (!placed) {
                    dropZone.element.appendChild(placeholder);
                }

                const isSameColumn = oldColumn === dropZone;
                const isOriginalPosition = dropIndex === originalIndex;
                const isBelowGhost = dropIndex === originalIndex + 1;

                if (isSameColumn && (isOriginalPosition || isBelowGhost)) {
                    placeholder.remove();
                }
            }
        } else if (dropZone.dropZoneType === 'create-area') {
            // Lógica copiada de ColumnCreateArea.onDragOver
            dropZone.element.classList.add('container__drop-area--active');
        }
    }

    /**
     * Handles the logic for a drag operation leaving a drop zone.
     * (Lógica movida de ColumnCreateArea.js)
     * @param {DragEvent} e - The native drag event.
     * @param {Column | ColumnCreateArea} dropZone - The drop zone instance (this).
     */
    handleDragLeave(e, dropZone) {
        if (dropZone.dropZoneType === 'create-area') {
            // Lógica copiada de ColumnCreateArea.onDragLeave
            dropZone.element.classList.remove('container__drop-area--active');
        }
    }

    /**
     * Handles the logic for a drop operation on a drop zone.
     * (Lógica movida de Column.js e ColumnCreateArea.js)
     * @param {DragEvent} e - The native drag event.
     * @param {Column | ColumnCreateArea} dropZone - The drop zone instance (this).
     */
    handleDrop(e, dropZone) {
        const draggedItem = this.getDraggedItem();
        const placeholder = this.getPlaceholder();

        if (!draggedItem || !(draggedItem instanceof PanelGroup)) {
            return;
        }

        // Lógica específica da Drop Zone
        if (dropZone.dropZoneType === 'column') {
            // Lógica copiada de Column.onDrop
            const oldColumn = draggedItem.state.column;

            if (placeholder.parentElement !== dropZone.element) {
                if (oldColumn === dropZone) {
                    oldColumn.updatePanelGroupsSizes();
                    return;
                }
            }

            const allChildren = Array.from(dropZone.element.children);
            let panelIndex = 0;
            for (const child of allChildren) {
                if (child === placeholder) break;
                if (child.classList.contains('panel-group')) {
                    panelIndex++;
                }
            }

            placeholder.remove();

            if (oldColumn) {
                const originalIndex = oldColumn.getPanelGroupIndex(draggedItem);
                if (
                    oldColumn === dropZone &&
                    (panelIndex === originalIndex || panelIndex === originalIndex + 1)
                ) {
                    oldColumn.updatePanelGroupsSizes();
                    return;
                }
            }

            draggedItem.state.height = null;
            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            dropZone.addPanelGroup(draggedItem, panelIndex);
        } else if (dropZone.dropZoneType === 'create-area') {
            // Lógica copiada de ColumnCreateArea.onDrop
            dropZone.element.classList.remove('container__drop-area--active');
            const oldColumn = draggedItem.state.column;

            const index = Array.from(dropZone.state.container.element.children).indexOf(
                dropZone.element
            );
            const newColumn = dropZone.state.container.createColumn(null, index);

            if (oldColumn) {
                oldColumn.removePanelGroup(draggedItem, true);
            }
            newColumn.addPanelGroup(draggedItem);
        }
    }

    // --- Métodos Privados ---

    /**
     * Creates the placeholder element based on the BEM class.
     * @private
     */
    _createPlaceholder() {
        this._placeholder = document.createElement('div');
        this._placeholder.classList.add('container__placeholder');
    }

    /**
     * Subscribes to the global appBus D&D events.
     * @private
     */
    _initEventListeners() {
        appBus.on('dragstart', this._onDragStart.bind(this));
        appBus.on('dragend', this._onDragEnd.bind(this));
    }

    /**
     * Handles the 'dragstart' event from the appBus.
     * @param {object} payload - The event payload { item: PanelGroup, event: DragEvent }.
     * @private
     */
    _onDragStart(payload) {
        if (!payload || !payload.item) return;

        const item = payload.item;
        const e = payload.event;

        // 1. Definir Estado
        this._draggedItem = item;
        this._isDragging = true;

        // 2. Aplicar lógica de D&D (copiado de Container.startDrag)
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.dropEffect = 'move';
        item.element.classList.add('dragging');
        this._placeholder.style.height = `${item.element.offsetHeight}px`;
        e.dataTransfer.setDragImage(item.element, 20, 20);
    }

    /**
     * Handles the 'dragend' event from the appBus.
     * @private
     */
    _onDragEnd() {
        // 1. Remover placeholder do DOM
        if (this._placeholder.parentElement) {
            this._placeholder.parentElement.removeChild(this._placeholder);
        }

        // 2. Remover feedback visual
        if (this._draggedItem && this._draggedItem.element) {
            this._draggedItem.element.classList.remove('dragging');
        }

        // 3. Resetar Estado
        this._draggedItem = null;
        this._isDragging = false;
    }
}

