import { BaseDropStrategy } from './BaseDropStrategy.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy for handling drops into the Tab area of a PanelGroup.
 * It allows reordering panels within the same group or moving panels between groups.
 *
 * Properties summary:
 * - _dropIndex {number | null} : The calculated index for the drop.
 *
 * Business rules implemented:
 * - Validates that the dragged item is a Panel (or compatible type).
 * - Calculates the insertion index based on the horizontal midpoint of existing tabs.
 * - Inserts a vertical placeholder to indicate the drop position.
 * - Supports dropping into empty tab strips (though rare in PanelGroups).
 * - Updates the dropZone visual feedback (classes).
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Panel/PanelGroup.js').PanelGroup}
 * - {import('../../constants/DNDTypes.js').ItemType}
 */
export class TabContainerDropStrategy extends BaseDropStrategy {
    /**
     * The calculated index for the drop.
     *
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * Clears internal cache.
     *
     * @returns {void}
     */
    clearCache() {
        this._dropIndex = null;
    }

    /**
     * Hook called when a drag enters the zone.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragEnter(point, dropZone, draggedData, dds) {
        if (!this._validateItem(draggedData)) return false;

        // Access the TabStrip element via the header
        // PanelGroup -> header (PanelGroupHeader) -> tabStrip (TabStrip) -> element
        const stripElement =
            dropZone.header && dropZone.header.tabStrip ? dropZone.header.tabStrip.element : null;

        if (stripElement) {
            stripElement.classList.add('panel-group__tab-container--drag-over');
        }
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Calculates insertion index.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        if (!this._validateItem(draggedData)) {
            dds.hidePlaceholder();
            return false;
        }

        if (!dropZone.header || !dropZone.header.tabStrip) {
            dds.hidePlaceholder();
            return false;
        }

        const stripElement = dropZone.header.tabStrip.element;

        // Find the inner scrollable container (Viewport of the Strip) to place the placeholder
        // This is critical because TabStrip has buttons and a viewport wrapper
        const scrollContainer = stripElement.querySelector('.ui-strip__viewport') || stripElement;

        const placeholder = dds.getPlaceholder();
        const panels = dropZone.panels || [];

        // Filter panels to get their header elements
        // We use the logical panels list from the Group to calculate positions
        let targetPanel = null;
        let placed = false;
        this._dropIndex = panels.length;

        for (let i = 0; i < panels.length; i++) {
            const panel = panels[i];
            // Access the header UIElement
            const headerElement = panel.header ? panel.header.element : null;

            if (headerElement) {
                const rect = headerElement.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;

                if (point.x < midX) {
                    this._dropIndex = i;
                    targetPanel = panel;
                    placed = true;
                    break;
                }
            }
        }

        dds.showPlaceholder('vertical');

        // Insert placeholder into the DOM
        if (placed && targetPanel && targetPanel.header && targetPanel.header.element) {
            // Insert before the target tab
            scrollContainer.insertBefore(placeholder, targetPanel.header.element);
        } else {
            // Append to end
            scrollContainer.appendChild(placeholder);
        }

        return true;
    }

    /**
     * Cleanup on leave.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     */
    onDragLeave(point, dropZone, draggedData, dds) {
        const stripElement =
            dropZone.header && dropZone.header.tabStrip ? dropZone.header.tabStrip.element : null;
        if (stripElement) {
            stripElement.classList.remove('panel-group__tab-container--drag-over');
        }
    }

    /**
     * Hook called when the item is dropped.
     * Executes the move or add logic.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDrop(point, dropZone, draggedData, dds) {
        this.onDragLeave(point, dropZone, draggedData, dds);

        if (!this._validateItem(draggedData) || this._dropIndex === null) {
            return false;
        }

        const panel = draggedData.item;

        // Move logic
        if (dropZone.panels.includes(panel)) {
            dropZone.movePanel(panel, this._dropIndex);
        } else {
            // Moving from another group
            if (panel.parentGroup) {
                // Pass false to avoid disposal, as we are moving it
                panel.parentGroup.removePanel(panel, true);
            }
            dropZone.addPanel(panel, this._dropIndex, true);
        }

        return true;
    }

    /**
     * Validates if the dragged item is a Panel.
     *
     * @param {{item: object, type: string}} draggedData
     * @returns {boolean}
     * @private
     */
    _validateItem(draggedData) {
        // Accept Panel, TextPanel, ToolbarPanel, etc. based on checking inheritance or type
        // Assuming ItemType.PANEL covers specific panels or checking the instance
        // For simplicity, we check if it has a 'header' property which implies it's a Panel
        return (
            draggedData.item &&
            (draggedData.type === ItemType.PANEL ||
                draggedData.item.getPanelType() === 'Panel' ||
                draggedData.item.getPanelType() === 'TextPanel' ||
                draggedData.item.getPanelType() === 'ToolbarPanel' ||
                draggedData.item.getPanelType() === 'CounterPanel')
        );
    }
}
