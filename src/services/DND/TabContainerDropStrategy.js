import { PanelGroup } from '../../components/Panel/PanelGroup.js';
import { Panel } from '../../components/Panel/Panel.js';
import { FloatingPanelManagerService } from './FloatingPanelManagerService.js';

/**
 * Description:
 * A DND strategy that defines drop behavior for 'TabContainer' type drop zones
 * (i.e., the header area of a PanelGroup). This strategy handles merging
 * panels by moving a dropped Panel into the target PanelGroup.
 *
 * Properties summary:
 * - (None, this class is stateless)
 *
 * Business rules implemented:
 * - Accepts drops of type 'Panel'.
 * - Accepts drops of type 'PanelGroup' *only if* it contains exactly one Panel.
 * - On drop, it moves the single 'draggedPanel' from its 'sourceGroup'
 * to the 'targetGroup'.
 * - Provides visual feedback by adding a CSS class to the tab container.
 *
 * Dependencies:
 * - ../../components/Panel/PanelGroup.js
 * - ../../components/Panel/Panel.js
 */
export class TabContainerDropStrategy {
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
     * Applies visual feedback on drag enter.
     * @param {DragEvent} e - The native drag event.
     * @param {PanelGroup} dropZone - The target PanelGroup instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @param {import('./DragDropService.js').DragDropService} dds - The DND service instance.
     * @returns {void}
     */
    handleDragEnter(e, dropZone, draggedData, dds) {
        const groups = this._getGroups(draggedData, dropZone);

        if (!groups || groups.sourceGroup === groups.targetGroup) {
            return;
        }

        dds.hidePlaceholder();
        const tabContainerElement = dropZone._state.header.tabContainer;
        if (tabContainerElement) {
            tabContainerElement.classList.add('panel-group__tab-container--droptarget');
        }
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
        const placeholder = dds.getPlaceholder();
        if (e.target !== dropZone.element && e.target !== placeholder) {
            dds.hidePlaceholder();
            this._dropIndex = null;
            return;
        }

        const groups = this._getGroups(draggedData, dropZone);
        if (!groups || groups.sourceGroup === groups.targetGroup) {
            return;
        }

        dds.hidePlaceholder();
        const tabContainerElement = dropZone._state.header.tabContainer;
        if (tabContainerElement) {
            tabContainerElement.classList.add('panel-group__tab-container--droptarget');
        }
    }

    /**
     * Removes visual feedback on drag leave.
     * @param {DragEvent} e - The native drag event.
     * @param {PanelGroup} dropZone - The target PanelGroup instance.
     * @returns {void}
     */
    handleDragLeave(e, dropZone) {
        const tabContainerElement = dropZone._state.header.tabContainer;
        if (!tabContainerElement) return;

        if (e.relatedTarget && tabContainerElement.contains(e.relatedTarget)) {
            return;
        }
        tabContainerElement.classList.remove('panel-group__tab-container--droptarget');
    }

    /**
     * Handles the drop logic for merging tabs/panels.
     * @param {DragEvent} e - The native drag event.
     * @param {PanelGroup} dropZone - The target PanelGroup instance.
     * @param {{item: object, type: string}} draggedData - The item being dragged.
     * @returns {void}
     */
    handleDrop(e, dropZone, draggedData) {
        const tabContainerElement = dropZone._state.header.tabContainer;

        if (tabContainerElement) {
            tabContainerElement.classList.remove('panel-group__tab-container--droptarget');
        }

        const groups = this._getGroups(draggedData, dropZone);
        if (!groups || groups.sourceGroup === groups.targetGroup) {
            return;
        }

        const { draggedPanel, sourceGroup, targetGroup } = groups;

        if (sourceGroup._state.isFloating) {
            if (draggedData.type === 'PanelGroup') {
                FloatingPanelManagerService.getInstance().removeFloatingPanel(sourceGroup);
            }
        }

        sourceGroup.removePanel(draggedPanel);
        targetGroup.addPanel(draggedPanel, true); // Add and make active
    }

    /**
     * Clears any stray visual feedback from all tab containers.
     * @returns {void}
     */
    clearCache() {
        const zones = document.querySelectorAll('.panel-group__tab-container--droptarget');
        zones.forEach(zone => zone.classList.remove('panel-group__tab-container--droptarget'));
    }
}
