import { BaseDropStrategy } from './BaseDropStrategy.js';
import { FastDOM } from '../../utils/FastDOM.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { PopoutManagerService } from '../PopoutManagerService.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'column' type drop zones.
 * It handles rearranging PanelGroups and Viewports vertically within a Column, or
 * creating a new PanelGroup wrapper if a single Panel (tab) is dropped.
 *
 * Properties summary:
 * - _dropZoneCache {Array<object>} : Caches the geometry of child components.
 * - _dropIndex {number | null} : The calculated drop index.
 *
 * Business rules implemented:
 * - Caches child (PanelGroup/Viewport) geometry on 'onDragEnter'.
 * - Calculates drop index based on 'middleY' (vertical midpoint) of children.
 * - Shows a 'horizontal' placeholder in the calculated gap.
 * - Implements "ghost" logic to prevent flickering when dragging over
 * its own original position.
 * - Validates drop zone strictly: The target MUST be the column element itself
 * or the placeholder. Hovering over children is considered an invalid drop
 * for the Column (allowing specific strategies of the child to take over).
 * - On drop (PanelGroup): Moves the group to the new index using `addChild`.
 * - On drop (Panel): Creates a new PanelGroup wrapper at the index using `addChild`.
 * - Handles cleanup of Floating and Popout states upon drop.
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Panel/PanelGroup.js').PanelGroup}
 * - {import('../../components/Viewport/Viewport.js').Viewport}
 * - {import('./FloatingPanelManagerService.js').FloatingPanelManagerService}
 * - {import('../PopoutManagerService.js').PopoutManagerService}
 * - {import('../../constants/DNDTypes.js').ItemType}
 */
export class ColumnDropStrategy extends BaseDropStrategy {
    /**
     * Caches the geometry (middleY) and index of child components.
     *
     * @type {Array<{element: HTMLElement, middleY: number, originalIndex: number}>}
     * @private
     */
    _dropZoneCache = [];

    /**
     * The calculated drop index (state).
     *
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * Clears the internal geometry cache and drop index.
     *
     * @returns {void}
     */
    clearCache() {
        const me = this;
        me._dropZoneCache = [];
        me._dropIndex = null;
    }

    /**
     * Hook called when a drag enters the zone.
     * Caches the geometry of child components (PanelGroups and Viewports).
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The drag point.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The drag data.
     * @param {import('./DragDropService.js').DragDropService} dragDropService - The DND service.
     * @returns {boolean} True if handled.
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

        let draggedItem = null;
        if (draggedData.type === ItemType.PANEL_GROUP) {
            draggedItem = draggedData.item;
        } else if (draggedData.type === ItemType.PANEL) {
            draggedItem = draggedData.item.parentGroup;
            if (!draggedItem) return false;
        }

        me.clearCache();
        const children = dropZone.children;

        FastDOM.measure(() => {
            for (let index = 0; index < children.length; index++) {
                const targetChild = children[index];
                if (draggedItem === targetChild) continue;

                const rectangle = targetChild.element.getBoundingClientRect();
                const middleY = rectangle.top + rectangle.height / 2;

                me._dropZoneCache.push({
                    element: targetChild.element,
                    middleY: middleY,
                    originalIndex: index
                });
            }
        });
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Calculates the drop position and shows the placeholder.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The drag point.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The drag data.
     * @param {import('./DragDropService.js').DragDropService} dragDropService - The DND service.
     * @returns {boolean} True if handled.
     */
    onDragOver(point, dropZone, draggedData, dragDropService) {
        const me = this;
        const placeholder = dragDropService.getPlaceholder();

        if (point.target !== dropZone.element && point.target !== placeholder) {
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

        if (me._dropZoneCache.length === 0 && dropZone.children.length > 0) {
            me.onDragEnter(point, dropZone, draggedData, dragDropService);
        }

        FastDOM.measure(() => {
            const { index, targetElement } = me._calculateDropIndex(point.y, dropZone);

            const isGhost = me._isGhostPosition(effectiveItem, dropZone, index);
            const draggedElement =
                draggedData.type === ItemType.PANEL_GROUP
                    ? draggedData.item.element
                    : draggedData.item.parentGroup.element;
            const offsetHeight = draggedElement.offsetHeight;

            FastDOM.mutate(() => {
                me._dropIndex = index;

                if (isGhost) {
                    dragDropService.hidePlaceholder();
                    me._dropIndex = null;
                    return;
                }

                dragDropService.showPlaceholder('horizontal', offsetHeight);

                if (targetElement) {
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
     * Moves the PanelGroup or creates a new wrapper for a Panel.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The drop point.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The drag data.
     * @param {import('./DragDropService.js').DragDropService} dragDropService - The DND service.
     * @returns {boolean} True if successful.
     */
    onDrop(point, dropZone, draggedData, dragDropService) {
        const me = this;

        if (!dragDropService || !point) return false;

        const targetIndex = me._dropIndex;

        if (
            !draggedData.item ||
            (draggedData.type !== ItemType.PANEL_GROUP && draggedData.type !== ItemType.PANEL)
        ) {
            return false;
        }

        const sourceGroup = me._getSourceGroup(draggedData);
        if (!sourceGroup) return false;

        me._handleSourceCleanup(sourceGroup, draggedData.type);

        if (targetIndex === null) {
            me._handleInvalidDrop(draggedData);
            return false;
        }

        FastDOM.mutate(() => {
            if (draggedData.type === ItemType.PANEL_GROUP) {
                me._movePanelGroup(draggedData.item, dropZone, targetIndex);
            } else if (draggedData.type === ItemType.PANEL) {
                me._movePanelToNewGroup(draggedData.item, dropZone, targetIndex);
            }
        });

        return true;
    }

    /**
     * Determines the effective item being moved (the Group).
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
     * Calculates the drop index based on Y coordinate.
     *
     * @param {number} mouseY - The Y coordinate.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The drop zone.
     * @returns {{index: number, targetElement: HTMLElement|null}} The calculated position.
     * @private
     */
    _calculateDropIndex(mouseY, dropZone) {
        const me = this;
        let index = dropZone.children.length;
        let targetElement = null;

        for (const cacheItem of me._dropZoneCache) {
            if (mouseY < cacheItem.middleY) {
                index = cacheItem.originalIndex;
                targetElement = cacheItem.element;
                break;
            }
        }
        return { index, targetElement };
    }

    /**
     * Checks if the drop position is the same as the original position (Ghost).
     *
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} item - The item being dragged.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The drop zone.
     * @param {number} dropIndex - The calculated drop index.
     * @returns {boolean} True if it is a ghost position.
     * @private
     */
    _isGhostPosition(item, dropZone, dropIndex) {
        const oldColumn = typeof item.getColumn === 'function' ? item.getColumn() : null;

        if (oldColumn !== dropZone) {
            return false;
        }

        const originalIndex = dropZone.getChildIndex(item);
        const isOriginalPosition = dropIndex === originalIndex;
        const isBelowGhost = dropIndex === originalIndex + 1;

        return isOriginalPosition || isBelowGhost;
    }

    /**
     * Handles cleanup of Popout or Floating states.
     *
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} sourceGroup - The source group.
     * @param {string} type - The dragged item type.
     * @private
     * @returns {void}
     */
    _handleSourceCleanup(sourceGroup, type) {
        if (sourceGroup.isPopout) {
            if (type === ItemType.PANEL_GROUP || sourceGroup.panels.length <= 1) {
                PopoutManagerService.getInstance().closePopout(sourceGroup);
                sourceGroup.setPopoutMode(false);
            }
        } else if (sourceGroup.isFloating) {
            if (type === ItemType.PANEL_GROUP) {
                FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
            }
        }
    }

    /**
     * Handles invalid drop scenarios (e.g. ghost) by resetting layout.
     *
     * @param {{item: object, type: string}} draggedData - The drag data.
     * @private
     * @returns {void}
     */
    _handleInvalidDrop(draggedData) {
        const me = this;
        const itemToUpdate = me._getEffectiveDraggedItem(draggedData);

        if (itemToUpdate) {
            const oldColumn =
                typeof itemToUpdate.getColumn === 'function' ? itemToUpdate.getColumn() : null;
            if (oldColumn) {
                oldColumn.requestLayoutUpdate();
            }
        }
    }

    /**
     * Moves an entire PanelGroup to the new column index.
     *
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} draggedItem - The group.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The target column.
     * @param {number} targetIndex - The target index.
     * @private
     * @returns {void}
     */
    _movePanelGroup(draggedItem, dropZone, targetIndex) {
        const oldColumn =
            typeof draggedItem.getColumn === 'function' ? draggedItem.getColumn() : null;

        if (draggedItem.height !== null && draggedItem.height !== undefined) {
            draggedItem.height = null;
        }

        if (oldColumn) {
            oldColumn.removeChild(draggedItem, true);
        }
        dropZone.addChild(draggedItem, targetIndex);
    }

    /**
     * Moves a single Panel into a new PanelGroup wrapper within the column.
     *
     * @param {import('../../components/Panel/Panel.js').Panel} draggedPanel - The panel.
     * @param {import('../../components/Column/Column.js').Column} dropZone - The target column.
     * @param {number} targetIndex - The target index.
     * @private
     * @returns {void}
     */
    _movePanelToNewGroup(draggedPanel, dropZone, targetIndex) {
        const sourceParentGroup = draggedPanel.parentGroup;

        const newPanelGroup = new PanelGroup();
        dropZone.addChild(newPanelGroup, targetIndex);

        if (sourceParentGroup) {
            sourceParentGroup.removePanel(draggedPanel, true);
        }
        draggedPanel.height = null;
        newPanelGroup.addPanel(draggedPanel, true);
    }
}
