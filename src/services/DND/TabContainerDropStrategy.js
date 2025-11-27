import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';
import { PopoutManagerService } from '../PopoutManagerService.js';
import { BaseDropStrategy } from './BaseDropStrategy.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * A DND strategy for 'TabContainer' drop zones (PanelGroup headers).
 * It allows reordering panels within the same group or moving panels between groups.
 *
 * Properties summary:
 * - _isReordering {boolean} : State flag, true if dragging within the same group.
 * - _dropIndex {number | null} : The calculated state index for reordering/merging.
 * - _tabCache {Array<object>} : Caches geometry of sibling tabs for reordering.
 *
 * Business rules implemented:
 * - Validates that the dragged item is a Panel (or compatible type).
 * - Calculates the insertion index based on the horizontal midpoint of existing tabs.
 * - Inserts a vertical placeholder to indicate the drop position.
 * - Supports dropping into empty tab strips (though rare in PanelGroups).
 * - Updates the dropZone visual feedback (classes).
 * - Handles cleanup of Floating and Popout states upon drop.
 *
 * Dependencies:
 * - {import('./BaseDropStrategy.js').BaseDropStrategy}
 * - {import('../../components/Panel/PanelGroup.js').PanelGroup}
 * - {import('../../constants/DNDTypes.js').ItemType}
 * - {import('./FloatingPanelManagerService.js').FloatingPanelManagerService}
 * - {import('../PopoutManagerService.js').PopoutManagerService}
 */
export class TabContainerDropStrategy extends BaseDropStrategy {
    /**
     * State flag, true if dragging within the same group.
     *
     * @type {boolean}
     * @private
     */
    _isReordering = false;

    /**
     * The calculated state index for reordering/merging.
     *
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
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} dropZone - The target PanelGroup instance.
     * @returns {{draggedPanel: import('../../components/Panel/Panel.js').Panel, sourceGroup: import('../../components/Panel/PanelGroup.js').PanelGroup, targetGroup: import('../../components/Panel/PanelGroup.js').PanelGroup} | null}
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

        const item = draggedData.item;

        if (
            draggedData.type === ItemType.PANEL ||
            (item.getPanelType && item.getPanelType() !== ItemType.PANEL_GROUP)
        ) {
            draggedPanel = item;
            sourceGroup = draggedPanel.parentGroup;
        } else if (draggedData.type === ItemType.PANEL_GROUP) {
            if (item.panels.length === 1) {
                sourceGroup = item;
                draggedPanel = sourceGroup.panels[0];
            } else {
                return null;
            }
        } else {
            return null;
        }

        if (!targetGroup || !sourceGroup || !draggedPanel) {
            return null;
        }

        return { draggedPanel, sourceGroup, targetGroup };
    }

    /**
     * Caches the geometry of all tabs in the group for reordering.
     *
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} dropZone
     * @private
     */
    _cacheTabGeometry(dropZone) {
        const me = this;
        me._tabCache = [];
        const panels = dropZone.panels;

        panels.forEach((panel, index) => {
            if (panel.header && panel.header.element) {
                const tabElement = panel.header.element;
                const rect = tabElement.getBoundingClientRect();
                me._tabCache.push({
                    element: tabElement,
                    midX: rect.left + rect.width / 2,
                    stateIndex: index
                });
            }
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

        const zones = document.querySelectorAll('.panel-group__tab-container--drag-over');
        zones.forEach(zone => zone.classList.remove('panel-group__tab-container--drag-over'));
    }

    /**
     * Hook called when a drag enters the zone.
     * Applies visual feedback and caches geometry.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The drag point coordinates.
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The dragged data.
     * @param {import('./DragDropService.js').DragDropService} dragDropService - The DND service.
     * @returns {boolean} True if handled.
     */
    onDragEnter(point, dropZone, draggedData, dragDropService) {
        const me = this;
        me.clearCache(true);
        if (!draggedData.item) return false;

        if (draggedData.item === dropZone) {
            return false;
        }

        const groups = me._getGroups(draggedData, dropZone);
        if (!groups) {
            return false;
        }

        if (groups.sourceGroup === groups.targetGroup && groups.targetGroup.panels.length === 1) {
            return false;
        }

        me._isReordering = groups.sourceGroup === groups.targetGroup;
        me._cacheTabGeometry(dropZone);
        dragDropService.showPlaceholder('vertical');

        if (dropZone.header && dropZone.header.tabStrip) {
            const stripElement = dropZone.header.tabStrip.element;
            if (stripElement) {
                stripElement.classList.add('panel-group__tab-container--drag-over');
            }
        }

        return true;
    }

    /**
     * Hook called when a drag moves over the zone.
     * Maintains visual feedback and calculates drop index using Live Geometry.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The drag point coordinates.
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The dragged data.
     * @param {import('./DragDropService.js').DragDropService} dragDropService - The DND service.
     * @returns {boolean} True if handled.
     */
    onDragOver(point, dropZone, draggedData, dragDropService) {
        const me = this;

        if (!dropZone.header || !dropZone.header.tabStrip) {
            dragDropService.hidePlaceholder();
            return false;
        }

        const stripElement = dropZone.header.tabStrip.element;
        if (!stripElement) return false;

        const scrollContainer = stripElement.querySelector('.ui-strip__viewport') || stripElement;
        const placeholder = dragDropService.getPlaceholder();

        const groups = me._getGroups(draggedData, dropZone);
        if (!groups) {
            return false;
        }

        me._isReordering = groups.sourceGroup === groups.targetGroup;
        const { draggedPanel } = groups;
        const originalIndex = dropZone.panels.indexOf(draggedPanel);

        let targetElement = null;
        let placed = false;
        me._dropIndex = dropZone.panels.length;

        if (me._tabCache.length === 0 && dropZone.panels.length > 0) {
            me._cacheTabGeometry(dropZone);
        }

        for (let index = 0; index < me._tabCache.length; index++) {
            const cache = me._tabCache[index];
            if (me._isReordering && cache.stateIndex === originalIndex) continue;

            if (point.x < cache.midX) {
                targetElement = cache.element;
                me._dropIndex = cache.stateIndex;
                placed = true;
                break;
            }
        }

        if (me._isReordering) {
            if (me._dropIndex === originalIndex || me._dropIndex === originalIndex + 1) {
                dragDropService.hidePlaceholder();
                me._dropIndex = null;
                return false;
            }
        }

        if (!stripElement.classList.contains('panel-group__tab-container--drag-over')) {
            stripElement.classList.add('panel-group__tab-container--drag-over');
        }

        dragDropService.showPlaceholder('vertical');

        if (placed && targetElement) {
            if (scrollContainer.contains(targetElement)) {
                scrollContainer.insertBefore(placeholder, targetElement);
            } else {
                scrollContainer.appendChild(placeholder);
            }
        } else {
            scrollContainer.appendChild(placeholder);
        }

        return true;
    }

    /**
     * Hook called when the item is dropped.
     * Handles logic for merging tabs/panels or reordering.
     *
     * @param {{x: number, y: number, target: HTMLElement}} point - The drop point coordinates.
     * @param {import('../../components/Panel/PanelGroup.js').PanelGroup} dropZone - The drop zone instance.
     * @param {{item: object, type: string}} draggedData - The dragged data.
     * @param {import('./DragDropService.js').DragDropService} dragDropService - The DND service.
     * @returns {boolean} True if successful.
     */
    onDrop(point, dropZone, draggedData, dragDropService) {
        const me = this;

        if (!dragDropService || !point) {
            // Intentional fallthrough, just ensuring variables are used or ignored
        }

        if (dropZone.header && dropZone.header.tabStrip && dropZone.header.tabStrip.element) {
            dropZone.header.tabStrip.element.classList.remove(
                'panel-group__tab-container--drag-over'
            );
        }

        const groups = me._getGroups(draggedData, dropZone);
        if (!groups || me._dropIndex === null) {
            return false;
        }

        const { draggedPanel, sourceGroup, targetGroup } = groups;

        if (me._isReordering) {
            dropZone.movePanel(draggedPanel, me._dropIndex);
        } else {
            if (sourceGroup.isPopout) {
                PopoutManagerService.getInstance().closePopout(sourceGroup);
                sourceGroup.setPopoutMode(false);
            } else if (sourceGroup.isFloating) {
                FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
            }

            sourceGroup.removePanel(draggedPanel, true);
            targetGroup.addPanel(draggedPanel, me._dropIndex, true);
        }

        return true;
    }
}
