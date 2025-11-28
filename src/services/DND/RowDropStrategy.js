import { BaseDropStrategy } from './BaseDropStrategy.js';
import { FastDOM } from '../../utils/FastDOM.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { PopoutManagerService } from '../PopoutManagerService.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'row' type drop zones.
 * It handles dropping panels into the horizontal gaps *between* Columns,
 * creating a new Column for the dropped item.
 *
 * Properties summary:
 * - _dropIndex {number | null} : The calculated drop index (column index).
 *
 * Business rules implemented:
 * - Uses "Live Geometry" in onDragOver to handle layout shifts caused by the placeholder.
 * - Calculates drop index based on 'middleX' (horizontal midpoint) of current columns.
 * - Shows a 'vertical' placeholder in the calculated gap.
 * - Implements "ghost" logic in real-time within onDragOver to prevent
 * redundant drops (e.g., dropping the sole content of a column next to itself).
 * - Validates drop zone strictly: The target MUST be inside the row element.
 * - On drop: Creates a new Column, creates a new PanelGroup inside it (or adds existing),
 * and moves the dropped Panel or PanelGroup into the new Column.
 * - Handles cleanup of Floating and Popout states upon drop, preserving popout if tabs remain.
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Panel/PanelGroup.js').PanelGroup}
 * - {import('../../components/Panel/Panel.js').Panel}
 * - {import('./FloatingPanelManagerService.js').FloatingPanelManagerService}
 * - {import('../PopoutManagerService.js').PopoutManagerService}
 * - {import('../../constants/DNDTypes.js').ItemType}
 */
export class RowDropStrategy extends BaseDropStrategy {
    /**
     * The calculated drop index (state).
     *
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * Clears the internal state and drop index.
     *
     * @returns {void}
     */
    clearCache() {
        const me = this;
        me._dropIndex = null;
    }

    /**
     * Hook called when a drag enters the zone.
     * Sets up initial state and validates the item type.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The drag point coordinates and target.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The drag data payload.
     * @param {import('./DragDropService.js').DragDropService} dragDropService - The DND service instance.
     * @returns {boolean} True if the strategy accepts the drag, false otherwise.
     */
    onDragEnter(point, dropZone, draggedData, dragDropService) {
        const me = this;

        if (!dragDropService) return false;

        if (
            !draggedData.item ||
            (draggedData.type !== ItemType.PANEL_GROUP && draggedData.type !== ItemType.PANEL)
        ) {
            return false;
        }

        me.clearCache();
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Calculates the drop position using Live Geometry and handles Ghost logic.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The drag point coordinates and target.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The drag data payload.
     * @param {import('./DragDropService.js').DragDropService} dragDropService - The DND service instance.
     * @returns {boolean} True if the drop position is valid and handled, false otherwise.
     */
    onDragOver(point, dropZone, draggedData, dragDropService) {
        const me = this;
        const placeholder = dragDropService.getPlaceholder();

        if (!dropZone.element.contains(point.target)) {
            FastDOM.mutate(() => {
                dragDropService.hidePlaceholder();
            });
            me._dropIndex = null;
            return false;
        }

        if (
            !draggedData.item ||
            (draggedData.type !== ItemType.PANEL_GROUP && draggedData.type !== ItemType.PANEL)
        ) {
            return false;
        }

        const effectiveItem = me._getEffectiveDraggedItem(draggedData);
        if (!effectiveItem) return false;

        FastDOM.measure(() => {
            let originalColumnIndex = -1;
            let isOriginSingle = false;

            const oldColumn =
                typeof effectiveItem.getColumn === 'function' ? effectiveItem.getColumn() : null;
            const columns = dropZone.getColumns();

            if (oldColumn && oldColumn.parentContainer === dropZone) {
                originalColumnIndex = columns.indexOf(oldColumn);

                if (originalColumnIndex !== -1) {
                    const childCount = oldColumn.getChildCount();

                    if (draggedData.type === ItemType.PANEL_GROUP && childCount === 1) {
                        isOriginSingle = true;
                    } else if (
                        draggedData.type === ItemType.PANEL &&
                        effectiveItem.panels.length === 1 &&
                        childCount === 1
                    ) {
                        isOriginSingle = true;
                    }
                }
            }

            const mouseX = point.x;
            let targetElement = null;
            let placed = false;
            let dropIndex = columns.length;

            for (let index = 0; index < columns.length; index++) {
                const column = columns[index];
                const rectangle = column.element.getBoundingClientRect();
                const middleX = rectangle.left + rectangle.width / 2;

                if (mouseX < middleX) {
                    dropIndex = index;
                    targetElement = column.element;
                    placed = true;
                    break;
                }
            }

            const isLeftGap = dropIndex === originalColumnIndex;
            const isRightGap = dropIndex === originalColumnIndex + 1;

            FastDOM.mutate(() => {
                me._dropIndex = dropIndex;

                if (isOriginSingle && (isLeftGap || isRightGap)) {
                    dragDropService.hidePlaceholder();
                    me._dropIndex = null;
                    return;
                }

                dragDropService.showPlaceholder('vertical');

                if (placed && targetElement) {
                    if (dropZone.element.contains(targetElement)) {
                        dropZone.element.insertBefore(placeholder, targetElement);
                    } else {
                        dropZone.element.appendChild(placeholder);
                    }
                } else {
                    dropZone.element.appendChild(placeholder);
                }
            });
        });

        return true;
    }

    /**
     * Hook called when the item is dropped.
     * Creates a new Column/PanelGroup and moves the item.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The drop point coordinates and target.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The drag data payload.
     * @param {import('./DragDropService.js').DragDropService} dragDropService - The DND service instance.
     * @returns {boolean} True if the drop was successful.
     */
    onDrop(point, dropZone, draggedData, dragDropService) {
        if (!dragDropService || !point) return false;

        const me = this;
        const initialPanelIndex = me._dropIndex;

        if (
            !draggedData.item ||
            (draggedData.type !== ItemType.PANEL_GROUP && draggedData.type !== ItemType.PANEL)
        ) {
            return false;
        }

        const sourceGroup = me._getSourceGroup(draggedData);
        if (!sourceGroup) return false;

        if (sourceGroup.isPopout) {
            if (draggedData.type === ItemType.PANEL_GROUP || sourceGroup.panels.length <= 1) {
                PopoutManagerService.getInstance().closePopout(sourceGroup);
                sourceGroup.setPopoutMode(false);
            }
        } else if (sourceGroup.isFloating) {
            if (draggedData.type === ItemType.PANEL_GROUP) {
                FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
            }
        }

        if (initialPanelIndex === null) {
            return false;
        }

        const itemToMove = draggedData.item;

        FastDOM.mutate(() => {
            if (draggedData.type === ItemType.PANEL_GROUP) {
                me._movePanelGroup(itemToMove, dropZone, initialPanelIndex);
            } else if (draggedData.type === ItemType.PANEL) {
                me._movePanelToNewGroup(itemToMove, dropZone, initialPanelIndex);
            }
        });

        return true;
    }

    /**
     * Determines the effective item being moved (the Group or the Panel's parent group).
     *
     * @param {{item: object, type: string}} draggedData - The drag data.
     * @returns {import('../../components/Panel/PanelGroup.js').PanelGroup | null} The effective item.
     * @private
     */
    _getEffectiveDraggedItem(draggedData) {
        if (draggedData.type === ItemType.PANEL_GROUP) {
            return draggedData.item;
        }
        if (draggedData.type === ItemType.PANEL) {
            return draggedData.item.parentGroup;
        }
        return null;
    }

    /**
     * Resolves the source PanelGroup from the drag data.
     *
     * @param {{item: object, type: string}} draggedData - The drag data.
     * @returns {import('../../components/Panel/PanelGroup.js').PanelGroup | null} The source group.
     * @private
     */
    _getSourceGroup(draggedData) {
        if (draggedData.type === ItemType.PANEL_GROUP) {
            return draggedData.item;
        }
        if (draggedData.type === ItemType.PANEL) {
            return draggedData.item.parentGroup;
        }
        return null;
    }

    /**
     * Moves an entire PanelGroup to a new column at the target index.
     *
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} draggedItem - The group being moved.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The target row.
     * @param {number} targetIndex - The index to insert the new column.
     * @private
     * @returns {void}
     */
    _movePanelGroup(draggedItem, dropZone, targetIndex) {
        const oldColumn =
            typeof draggedItem.getColumn === 'function' ? draggedItem.getColumn() : null;

        const newColumn = dropZone.createColumn(null, targetIndex);

        if (oldColumn) {
            oldColumn.removeChild(draggedItem, true);
        }
        draggedItem.height = null;

        newColumn.addChild(draggedItem);
    }

    /**
     * Moves a single Panel into a new PanelGroup wrapper within a new Column.
     *
     * @param {import('../../components/Panel/Panel.js').Panel} draggedPanel - The panel being moved.
     * @param {import('../../components/Row/Row.js').Row} dropZone - The target row.
     * @param {number} targetIndex - The index to insert the new column.
     * @private
     * @returns {void}
     */
    _movePanelToNewGroup(draggedPanel, dropZone, targetIndex) {
        const sourceParentGroup = draggedPanel.parentGroup;

        const newColumn = dropZone.createColumn(null, targetIndex);
        const newPanelGroup = new PanelGroup(null);

        newColumn.addChild(newPanelGroup);

        if (sourceParentGroup) {
            sourceParentGroup.removePanel(draggedPanel, true);
        }
        draggedPanel.height = null;
        newPanelGroup.addPanel(draggedPanel, true);
    }
}
