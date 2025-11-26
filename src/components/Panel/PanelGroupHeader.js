import { UIElement } from '../../core/UIElement.js';
import { VanillaPanelGroupHeaderAdapter } from '../../renderers/vanilla/VanillaPanelGroupHeaderAdapter.js';
import { TabStrip } from '../Core/TabStrip.js';
import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { DropZoneType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * Manages the header element of a PanelGroup.
 * This class acts as a controller that inherits from UIElement. It delegates
 * DOM creation to VanillaPanelGroupHeaderAdapter and composes a TabStrip
 * component to manage the list of tabs.
 *
 * Properties summary:
 * - panelGroup {PanelGroup} : Reference to the parent PanelGroup.
 * - title {string} : The title used for ARIA labels.
 * - tabStrip {TabStrip} : The component managing the list of tabs.
 * - moveHandle {HTMLElement|null} : The drag handle element (accessed via adapter).
 * - collapseBtn {HTMLElement|null} : Button to toggle collapse state (accessed via adapter).
 * - closeBtn {HTMLElement|null} : Button to close the group (accessed via adapter).
 *
 * Events:
 * - Emits (appBus): EventTypes.PANEL_TOGGLE_COLLAPSE
 * - Emits (appBus): EventTypes.PANEL_CLOSE_REQUEST
 * - Emits (appBus): EventTypes.DND_DRAG_START
 *
 * Business rules implemented:
 * - Composes TabStrip via the 'mount' lifecycle.
 * - Delegates DOM events to internal handlers.
 * - Updates visual state via adapter methods.
 * - Registers itself as a 'tab-container' drop zone to enable tab reordering.
 * - Handles "Simple Mode" visualization (showing title when single tab).
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaPanelGroupHeaderAdapter.js').VanillaPanelGroupHeaderAdapter}
 * - {import('../Core/TabStrip.js').TabStrip}
 * - {import('../../utils/EventBus.js').appBus}
 */
export class PanelGroupHeader extends UIElement {
    /**
     * Reference to the parent PanelGroup.
     *
     * @type {import('./PanelGroup.js').PanelGroup | null}
     * @private
     */
    _panelGroup = null;

    /**
     * The title used for ARIA labels.
     *
     * @type {string | null}
     * @private
     */
    _title = null;

    /**
     * The TabStrip component instance.
     *
     * @type {TabStrip}
     * @public
     */
    tabStrip;

    /**
     * Bound handler for collapse button click.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnCollapse = null;

    /**
     * Bound handler for close button click.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnClose = null;

    /**
     * Bound handler for pointer down on the move handle.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnGroupPointerDown = null;

    /**
     * Creates a new PanelGroupHeader instance.
     *
     * @param {import('./PanelGroup.js').PanelGroup} panelGroup - The parent PanelGroup instance.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(panelGroup, renderer = null) {
        super(null, renderer || new VanillaPanelGroupHeaderAdapter());
        const me = this;

        me.panelGroup = panelGroup;

        // Initialize TabStrip with Simple Mode enabled
        me.tabStrip = new TabStrip(
            `${panelGroup.id}-tabs`,
            {
                orientation: 'horizontal',
                simpleMode: true
            },
            renderer
        );

        me._boundOnCollapse = me._onCollapse.bind(me);
        me._boundOnClose = me._onClose.bind(me);
        me._boundOnGroupPointerDown = me._onGroupPointerDown.bind(me);

        // Initialize DOM via UIElement lifecycle
        me.render();
    }

    /**
     * Retrieves the parent PanelGroup instance.
     *
     * @returns {import('./PanelGroup.js').PanelGroup | null} The parent group.
     */
    get panelGroup() {
        const me = this;
        return me._panelGroup;
    }

    /**
     * Sets the parent PanelGroup instance.
     *
     * @param {import('./PanelGroup.js').PanelGroup | null} value - The new parent group.
     * @returns {void}
     */
    set panelGroup(value) {
        const me = this;
        if (value !== null && typeof value !== 'object') {
            console.warn(
                `[PanelGroupHeader] Invalid panelGroup assignment (${value}). Must be an object or null.`
            );
            return;
        }
        me._panelGroup = value;
    }

    /**
     * Retrieves the title used for ARIA labels.
     *
     * @returns {string | null} The title.
     */
    get title() {
        const me = this;
        return me._title;
    }

    /**
     * Sets the title.
     *
     * @param {string | null} value - The new title.
     * @returns {void}
     */
    set title(value) {
        const me = this;
        if (value !== null && typeof value !== 'string') {
            console.warn(
                `[PanelGroupHeader] Invalid title assignment (${value}). Must be a string or null.`
            );
            return;
        }
        me._title = value;
        me.updateAriaLabels();

        // Update title in renderer for Simple Mode display
        if (me.element) {
            me.renderer.updateTitle(me.element, value);
        }
    }

    /**
     * Accessor for the Move Handle element (via renderer).
     *
     * @returns {HTMLElement | null}
     */
    get moveHandle() {
        const me = this;
        if (me.element) {
            return me.renderer.getMoveHandle(me.element);
        }
        return null;
    }

    /**
     * Accessor for the Collapse Button element (via renderer).
     *
     * @returns {HTMLElement | null}
     */
    get collapseBtn() {
        const me = this;
        if (me.element) {
            return me.renderer.getCollapseButton(me.element);
        }
        return null;
    }

    /**
     * Accessor for the Close Button element (via renderer).
     *
     * @returns {HTMLElement | null}
     */
    get closeBtn() {
        const me = this;
        if (me.element) {
            return me.renderer.getCloseButton(me.element);
        }
        return null;
    }

    /**
     * Exposes the root element of the internal TabStrip.
     * Used by DND strategies to locate the drop target area.
     *
     * @returns {HTMLElement} The TabStrip root element.
     */
    get tabStripElement() {
        const me = this;
        return me.tabStrip.element;
    }

    /**
     * Compatibility method used by DND strategies.
     * Returns the DOM element where tabs are effectively dropped.
     *
     * @returns {HTMLElement|null} The tab container slot.
     */
    get tabContainer() {
        const me = this;
        return me.tabStripElement;
    }

    /**
     * Implementation of the rendering logic.
     * Uses the adapter to create the header structure.
     *
     * @returns {HTMLElement} The root header element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createHeaderElement(me.id);

        // Link DND properties from the parent group if available
        if (me.panelGroup) {
            element.dataset.dropzone = DropZoneType.TAB_CONTAINER;
            element.dropZoneInstance = me.panelGroup;

            const tabSlot = me.renderer.getTabContainerSlot(element);
            if (tabSlot) {
                tabSlot.dataset.dropzone = DropZoneType.TAB_CONTAINER;
                tabSlot.dropZoneInstance = me.panelGroup;
            }
        }

        // Note: Listeners are now attached in _doMount via _attachListeners
        // to ensure they persist across re-mounts (dock/undock).

        // Initialize title text
        me.renderer.updateTitle(element, me._title);

        return element;
    }

    /**
     * Helper to attach DOM event listeners.
     * Called on mount to ensure interactivity is restored if element was moved.
     *
     * @private
     */
    _attachListeners() {
        const me = this;
        if (!me.element) return;

        const moveHandle = me.renderer.getMoveHandle(me.element);
        const collapseBtn = me.renderer.getCollapseButton(me.element);
        const closeBtn = me.renderer.getCloseButton(me.element);

        if (moveHandle) {
            me.renderer.on(moveHandle, 'pointerdown', me._boundOnGroupPointerDown);
        }
        if (collapseBtn) {
            me.renderer.on(collapseBtn, 'click', me._boundOnCollapse);
        }
        if (closeBtn) {
            me.renderer.on(closeBtn, 'click', me._boundOnClose);
        }
    }

    /**
     * Helper to detach DOM event listeners.
     * Called on unmount to prevent leaks.
     *
     * @private
     */
    _detachListeners() {
        const me = this;
        if (!me.element) return;

        const moveHandle = me.renderer.getMoveHandle(me.element);
        const collapseBtn = me.renderer.getCollapseButton(me.element);
        const closeBtn = me.renderer.getCloseButton(me.element);

        if (moveHandle) me.renderer.off(moveHandle, 'pointerdown', me._boundOnGroupPointerDown);
        if (collapseBtn) me.renderer.off(collapseBtn, 'click', me._boundOnCollapse);
        if (closeBtn) me.renderer.off(closeBtn, 'click', me._boundOnClose);
    }

    /**
     * Implementation of mount logic.
     * Mounts the TabStrip into the designated slot.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        super._doMount(container);

        // [CORREÇÃO] Reattach listeners on mount to ensure they exist after undocking/docking
        me._attachListeners();

        const tabSlot = me.renderer.getTabContainerSlot(me.element);
        if (tabSlot) {
            me.tabStrip.mount(tabSlot);
        }

        // Connect TabStrip Simple Mode changes to Header Visuals
        if (me.tabStrip.onSimpleModeChange) {
            me.tabStrip.onSimpleModeChange(isSimple => {
                me.renderer.setSimpleMode(me.element, isSimple);
            });

            // Apply initial state
            me.renderer.setSimpleMode(me.element, me.tabStrip.isSimpleModeActive);
        }
    }

    /**
     * Implementation of unmount logic.
     * Cleans up listeners and sub-components.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;

        // [CORREÇÃO] Detach listeners explicitly
        me._detachListeners();

        // Unmount TabStrip
        if (me.tabStrip && me.tabStrip.isMounted) {
            me.tabStrip.unmount();
        }

        super._doUnmount();
    }

    /**
     * Disposes the component and its children.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me.tabStrip) {
            me.tabStrip.dispose();
        }
        super.dispose();
    }

    /**
     * Handler for collapse button click.
     *
     * @private
     * @returns {void}
     */
    _onCollapse() {
        const me = this;
        if (me.panelGroup) {
            appBus.emit(EventTypes.PANEL_TOGGLE_COLLAPSE, me.panelGroup);
        }
    }

    /**
     * Handler for close button click.
     *
     * @private
     * @returns {void}
     */
    _onClose() {
        const me = this;
        if (me.panelGroup) {
            appBus.emit(EventTypes.PANEL_CLOSE_REQUEST, me.panelGroup);
        }
    }

    /**
     * Handles drag start for the *entire group*.
     *
     * @param {PointerEvent} event - The pointerdown event.
     * @private
     * @returns {void}
     */
    _onGroupPointerDown(event) {
        const me = this;
        if (event.button !== 0) return;

        if (!me.panelGroup || !me.panelGroup.movable) return;

        event.preventDefault();
        event.stopPropagation();

        const target = event.target;
        if (target && typeof target.setPointerCapture === 'function') {
            target.setPointerCapture(event.pointerId);
        }

        const dragElement = me.panelGroup.element;
        const rect = dragElement.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;

        appBus.emit(EventTypes.DND_DRAG_START, {
            item: me.panelGroup,
            type: 'PanelGroup',
            element: dragElement,
            event: event,
            offsetX: offsetX,
            offsetY: offsetY
        });
    }

    /**
     * Updates ARIA labels for group control buttons.
     *
     * @returns {void}
     */
    updateAriaLabels() {
        const me = this;
        const title = me.panelGroup && me.panelGroup.title ? me.panelGroup.title : 'Grupo';
        if (me.element) {
            me.renderer.updateAriaLabels(me.element, title);
        }
    }

    /**
     * Updates the visual state of the collapse button.
     *
     * @param {boolean} isCollapsed - Whether the group is collapsed.
     * @returns {void}
     */
    updateCollapsedState(isCollapsed) {
        const me = this;
        if (me.element) {
            me.renderer.setCollapsedState(me.element, isCollapsed);
        }
    }

    /**
     * Sets the disabled state of the collapse button.
     *
     * @param {boolean} disabled - Whether the button is disabled.
     * @returns {void}
     */
    setCollapseButtonDisabled(disabled) {
        const me = this;
        if (me.element) {
            me.renderer.setCollapseButtonDisabled(me.element, disabled);
        }
    }

    /**
     * Updates the configuration (visibility) of header controls.
     *
     * @param {object} config - Configuration object.
     * @param {boolean} [config.closable] - Whether to show the close button.
     * @param {boolean} [config.movable] - Whether to show the move handle.
     * @returns {void}
     */
    updateConfig(config) {
        const me = this;
        if (!me.element) return;

        if (config.closable !== undefined) {
            me.renderer.setCloseButtonVisibility(me.element, config.closable);
        }
        if (config.movable !== undefined) {
            me.renderer.setMoveHandleVisibility(me.element, config.movable);
        }
    }
}
