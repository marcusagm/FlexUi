import { BaseDropStrategy } from './BaseDropStrategy.js';
import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { Panel } from '../../components/Panel/Panel.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy for 'TabContainer' drop zones (PanelGroup headers).
 * This strategy is stateful and handles two distinct modes:
 * 1. Merging: Dropping a Panel (or single-Panel Group) from *another* group.
 * 2. Reordering: Dropping a Panel (tab) *within* its own group to reorder it.
 *
 * Properties summary:
 * - _isReordering {boolean} : State flag, true if dragging within the same group.
 * - _dropIndex {number | null} : The calculated state index for reordering/merging.
 * - _tabCache {Array<object>} : Caches geometry of sibling tabs for reordering.
 *
 * Business rules implemented:
 * - On DragEnter: Detects if it's a Merge or Reorder operation and caches tab geometry.
 * - On DragOver: Calculates drop index based on `midX` of sibling tabs
 * and shows a 'vertical' placeholder between them for both modes.
 * - Implements "ghost" logic (only for reordering) to prevent dropping a tab
 * in its original position.
 * - Prevents dropping a PanelGroup onto itself.
 * - Prevents dropping a single Panel back into its own group if it's the only child.
 * - On Drop (Merge): Moves the panel into the target group at the specific `_dropIndex`.
 * - On Drop (Reorder): Calls `panelGroup.movePanel()` to update the tab order.
 * - Returns boolean indicating if the drop was handled.
 *
 * Dependencies:
 * - ./BaseDropStrategy.js
 * - ../../components/Panel/PanelGroup.js
 * - ../../components/Panel/Panel.js
 * - ./FloatingPanelManagerService.js
 * - ../../constants/DNDTypes.js
 */
export class TabContainerDropStrategy extends BaseDropStrategy {
    /**
     * @type {boolean}
     * @private
     */
    _isReordering = false;

    /**
     * @type {number | null}
     * @private
     */
    _dropIndex = null;

    /**
     * Caches geometry of sibling tabs for reordering.
     *
     * @type {Array<{element: HTMLElement, midX: number, stateIndex: number}>}
     * @private
     */
    _tabCache = [];

    /**
     * Helper to get the source/target groups and the specific panel being moved.
     *
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {PanelGroup} dropZone - The target PanelGroup instance.
     * @returns {{draggedPanel: Panel, sourceGroup: PanelGroup, targetGroup: PanelGroup} | null}
     * @private
     */
    _getGroups(draggedData, dropZone) {
        const targetGroup = dropZone;
        if (!targetGroup) return null;

        let draggedPanel = null;
        let sourceGroup = null;

        if (!draggedData.item) {
            return null;
        }

        if (draggedData.type === ItemType.PANEL) {
            if (!(draggedData.item instanceof Panel)) return null;
            draggedPanel = draggedData.item;
            sourceGroup = draggedPanel._state.parentGroup;
        } else if (draggedData.type === ItemType.PANEL_GROUP) {
            if (!(draggedData.item instanceof PanelGroup)) return null;
            if (draggedData.item._state.panels.length === 1) {
                sourceGroup = draggedData.item;
                draggedPanel = sourceGroup._state.panels[0];
            } else {
                return null; // Reject drop of multi-panel group
            }
        } else {
            return null; // Unknown type
        }

        if (!targetGroup || !sourceGroup || !draggedPanel) {
            return null;
        }

        return { draggedPanel, sourceGroup, targetGroup };
    }

    /**
     * Caches the geometry of all tabs in the group for reordering.
     *
     * @param {PanelGroup} dropZone
     * @private
     */
    _cacheTabGeometry(dropZone) {
        const me = this;
        me._tabCache = [];
        const panels = dropZone._state.panels;

        panels.forEach((panel, index) => {
            const tabElement = panel._state.header.element;
            const rect = tabElement.getBoundingClientRect();
            me._tabCache.push({
                element: tabElement,
                midX: rect.left + rect.width / 2,
                stateIndex: index
            });
        });
    }

    /**
     * Clears any stray visual feedback from all tab containers.
     *
     * @param {boolean} [visualOnly=false] - If true, only clears visual state.
     * @returns {void}
     */
    clearCache(visualOnly = false) {
        const me = this;
        if (!visualOnly) {
            me._isReordering = false;
            me._dropIndex = null;
            me._tabCache = [];
        }

        const zones = document.querySelectorAll('.panel-group__tab-container--droptarget');
        zones.forEach(zone => zone.classList.remove('panel-group__tab-container--droptarget'));
    }

    /**
     * Hook called when a drag enters the zone.
     * Applies visual feedback and caches geometry.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {PanelGroup} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragEnter(point, dropZone, draggedData, dds) {
        const me = this;
        me.clearCache(true); // Clear visual feedback only
        if (!draggedData.item) return false;

        if (draggedData.item === dropZone) {
            return false;
        }

        const groups = me._getGroups(draggedData, dropZone);
        if (!groups) {
            return false;
        }

        if (
            groups.sourceGroup === groups.targetGroup &&
            groups.targetGroup._state.panels.length === 1
        ) {
            return false;
        }

        me._isReordering = groups.sourceGroup === groups.targetGroup;
        me._cacheTabGeometry(dropZone);
        dds.showPlaceholder('vertical');
        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Maintains visual feedback and calculates drop index using Live Geometry.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {PanelGroup} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDragOver(point, dropZone, draggedData, dds) {
        const me = this;
        const placeholder = dds.getPlaceholder();
        const tabContainerElement = dropZone._state.header.tabContainer;

        if (draggedData.item === dropZone) {
            // Delegate cleanup to BaseDropStrategy via return false
            return false;
        }

        if (
            point.target &&
            !tabContainerElement.contains(point.target) &&
            point.target !== tabContainerElement &&
            point.target !== placeholder
        ) {
            return false;
        }

        const groups = me._getGroups(draggedData, dropZone);
        if (!groups) {
            return false;
        }

        if (
            groups.sourceGroup === groups.targetGroup &&
            groups.targetGroup._state.panels.length === 1
        ) {
            return false;
        }

        // Robustness: Ensure _isReordering is set even if DragEnter was skipped
        me._isReordering = groups.sourceGroup === groups.targetGroup;

        const { draggedPanel } = groups;
        const originalIndex = dropZone._state.panels.indexOf(draggedPanel);

        // --- Live Geometry Calculation ---
        const panels = dropZone._state.panels;
        let targetElement = null;
        let placed = false;
        me._dropIndex = panels.length;

        for (let i = 0; i < panels.length; i++) {
            const panel = panels[i];
            const tabElement = panel._state.header.element;

            const rect = tabElement.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;

            if (point.x < midX) {
                targetElement = tabElement;
                me._dropIndex = i;
                placed = true;
                break;
            }
        }

        if (me._isReordering) {
            const isAdjacent =
                me._dropIndex === originalIndex || me._dropIndex === originalIndex + 1;
            if (isAdjacent) {
                dds.hidePlaceholder();
                me._dropIndex = null;
                return false;
            }
        }

        dds.showPlaceholder('vertical');
        if (placed) {
            tabContainerElement.insertBefore(placeholder, targetElement);
        } else {
            tabContainerElement.appendChild(placeholder);
        }

        return true;
    }

    /**
     * Hook called when the item is dropped.
     * Handles logic for merging tabs/panels or reordering.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point
     * @param {PanelGroup} dropZone
     * @param {{item: object, type: string}} draggedData
     * @param {import('./DragDropService.js').DragDropService} dds
     * @returns {boolean}
     */
    onDrop(point, dropZone, draggedData, dds) {
        const me = this;
        const groups = me._getGroups(draggedData, dropZone);

        if (!groups) {
            return false;
        }

        // Recalculate isReordering just to be safe
        me._isReordering = groups.sourceGroup === groups.targetGroup;

        const { draggedPanel, sourceGroup, targetGroup } = groups;

        if (me._isReordering) {
            if (me._dropIndex !== null) {
                dropZone.movePanel(draggedPanel, me._dropIndex);
            }
        } else {
            if (sourceGroup._state.isFloating) {
                if (draggedData.type === ItemType.PANEL_GROUP) {
                    FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
                }
            }

            sourceGroup.removePanel(draggedPanel, true);
            targetGroup.addPanel(draggedPanel, me._dropIndex, true);
        }

        return true;
    }
}
