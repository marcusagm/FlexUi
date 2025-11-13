import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { Panel } from '../../components/Panel/Panel.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';

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
 * - On Drop (Merge): Moves the panel into the target group at the specific `_dropIndex`.
 * - On Drop (Reorder): Calls `panelGroup.movePanel()` to update the tab order.
 *
 * Dependencies:
 * - ../../components/Panel/PanelGroup.js
 * - ../../components/Panel/Panel.js
 * - ./FloatingPanelManagerService.js
 */
export class TabContainerDropStrategy {
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
     * @type {Array<{element: HTMLElement, midX: number, stateIndex: number}>}
     * @private
     */
    _tabCache = [];

    /**
     * Helper to get the source/target groups and the specific panel being moved.
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

        if (draggedData.type === 'Panel') {
            if (!(draggedData.item instanceof Panel)) return null;
            draggedPanel = draggedData.item;
            sourceGroup = draggedPanel._state.parentGroup;
        } else if (draggedData.type === 'PanelGroup') {
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
     * Applies visual feedback on drag enter.
     * @param {DragEvent} e - The native drag event.
     * @param {PanelGroup} dropZone - The target PanelGroup instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {import('./DragDropService.js').DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragEnter(e, dropZone, draggedData, dds) {
        const me = this;
        me.clearCache(true); // Clear visual feedback only
        if (!draggedData.item) return;

        const groups = me._getGroups(draggedData, dropZone);
        if (!groups) {
            return;
        }

        me._isReordering = groups.sourceGroup === groups.targetGroup;
        me._cacheTabGeometry(dropZone);
        dds.showPlaceholder('vertical');
    }

    /**
     * Maintains visual feedback on drag over.
     * @param {DragEvent} e - The native drag event.
     * @param {PanelGroup} dropZone - The target PanelGroup instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {import('./DragDropService.js').DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragOver(e, dropZone, draggedData, dds) {
        const me = this;
        const placeholder = dds.getPlaceholder();
        const tabContainerElement = dropZone._state.header.tabContainer;

        if (!tabContainerElement.contains(e.target) && e.target !== tabContainerElement) {
            me.handleDragLeave(e, dropZone, draggedData, dds);
            return;
        }

        const groups = me._getGroups(draggedData, dropZone);
        if (!groups) {
            return;
        }

        const { draggedPanel } = groups;
        const originalIndex = dropZone._state.panels.indexOf(draggedPanel);

        let targetElement = null;
        let placed = false;
        me._dropIndex = dropZone._state.panels.length;

        for (const tab of me._tabCache) {
            if (e.clientX < tab.midX) {
                targetElement = tab.element;
                me._dropIndex = tab.stateIndex;
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
                return;
            }
        }

        dds.showPlaceholder('vertical');
        if (placed) {
            tabContainerElement.insertBefore(placeholder, targetElement);
        } else {
            tabContainerElement.appendChild(placeholder);
        }
    }

    /**
     * Removes visual feedback on drag leave.
     * @param {DragEvent} e - The native drag event.
     * @param {PanelGroup} dropZone - The target PanelGroup instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {import('./DragDropService.js').DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragLeave(e, dropZone, draggedData, dds) {
        const me = this;
        const tabContainerElement = dropZone._state.header.tabContainer;
        if (!tabContainerElement) return;

        if (
            e.relatedTarget &&
            (tabContainerElement.contains(e.relatedTarget) ||
                e.relatedTarget.classList.contains('container__placeholder'))
        ) {
            return;
        }

        dds.hidePlaceholder();
        me.clearCache();
    }

    /**
     * Handles the drop logic for merging tabs/panels.
     * @param {DragEvent} e - The native drag event.
     * @param {PanelGroup} dropZone - The target PanelGroup instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {import('./DragDropService.js').DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDrop(e, dropZone, draggedData, dds) {
        const me = this;
        dds.hidePlaceholder();

        const groups = me._getGroups(draggedData, dropZone);
        if (!groups) {
            me.clearCache();
            return;
        }

        const { draggedPanel, sourceGroup, targetGroup } = groups;

        if (me._isReordering) {
            if (me._dropIndex !== null) {
                dropZone.movePanel(draggedPanel, me._dropIndex);
            }
        } else {
            if (sourceGroup._state.isFloating) {
                if (draggedData.type === 'PanelGroup') {
                    FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
                }
            }

            sourceGroup.removePanel(draggedPanel, true);
            targetGroup.addPanel(draggedPanel, me._dropIndex, true); // Add and make active
        }

        me.clearCache();
    }

    /**
     * Clears any stray visual feedback from all tab containers.
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
}
