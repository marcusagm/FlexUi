import { UIElement } from '../../core/UIElement.js';
import { VanillaPanelGroupHeaderAdapter } from '../../renderers/vanilla/VanillaPanelGroupHeaderAdapter.js';
import { TabStrip } from '../Core/TabStrip.js';
import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { DropZoneType } from '../../constants/DNDTypes.js';
import { PopoutManagerService } from '../../services/PopoutManagerService.js';

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
 * - Registers itself as a 'tab-container' drop zone.
 * - Handles "Simple Mode" visualization via TabStrip callbacks.
 * - Manages Popout/Return actions via PopoutManagerService.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaPanelGroupHeaderAdapter.js').VanillaPanelGroupHeaderAdapter}
 * - {import('../Core/TabStrip.js').TabStrip}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../services/PopoutManagerService.js').PopoutManagerService}
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
     * Bound handler for popout button click.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnPopout = null;

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
        me._boundOnPopout = me._onPopout.bind(me);
        me._boundOnGroupPointerDown = me._onGroupPointerDown.bind(me);

        me.render();
    }

    /**
     * Retrieves the parent PanelGroup instance.
     *
     * @returns {import('./PanelGroup.js').PanelGroup | null} The parent group.
     */
    get panelGroup() {
        return this._panelGroup;
    }

    /**
     * Sets the parent PanelGroup instance.
     *
     * @param {import('./PanelGroup.js').PanelGroup | null} value - The new parent group.
     * @returns {void}
     */
    set panelGroup(value) {
        if (value !== null && typeof value !== 'object') {
            console.warn(
                `[PanelGroupHeader] Invalid panelGroup assignment (${value}). Must be an object or null.`
            );
            return;
        }
        this._panelGroup = value;
    }

    /**
     * Retrieves the title used for ARIA labels.
     *
     * @returns {string | null} The title.
     */
    get title() {
        return this._title;
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
     * Accessor for the Popout Button element (via renderer).
     *
     * @returns {HTMLElement | null}
     */
    get popoutBtn() {
        const me = this;
        if (me.element) {
            return me.renderer.getPopoutButton(me.element);
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
     *
     * @returns {HTMLElement} The TabStrip root element.
     */
    get tabStripElement() {
        return this.tabStrip.element;
    }

    /**
     * Compatibility method used by DND strategies.
     *
     * @returns {HTMLElement|null} The tab container slot.
     */
    get tabContainer() {
        return this.tabStripElement;
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

        if (me.panelGroup) {
            element.dataset.dropzone = DropZoneType.TAB_CONTAINER;
            element.dropZoneInstance = me.panelGroup;

            const tabSlot = me.renderer.getTabContainerSlot(element);
            if (tabSlot) {
                tabSlot.dataset.dropzone = DropZoneType.TAB_CONTAINER;
                tabSlot.dropZoneInstance = me.panelGroup;
            }
        }
        return element;
    }

    /**
     * Helper to attach DOM event listeners.
     *
     * @private
     */
    _attachListeners() {
        const me = this;
        if (!me.element) return;

        const moveHandle = me.renderer.getMoveHandle(me.element);
        const popoutBtn = me.renderer.getPopoutButton(me.element);
        const collapseBtn = me.renderer.getCollapseButton(me.element);
        const closeBtn = me.renderer.getCloseButton(me.element);

        if (moveHandle) {
            me.renderer.on(moveHandle, 'pointerdown', me._boundOnGroupPointerDown);
        }
        if (popoutBtn) {
            me.renderer.on(popoutBtn, 'click', me._boundOnPopout);
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
     *
     * @private
     */
    _detachListeners() {
        const me = this;
        if (!me.element) return;

        const moveHandle = me.renderer.getMoveHandle(me.element);
        const popoutBtn = me.renderer.getPopoutButton(me.element);
        const collapseBtn = me.renderer.getCollapseButton(me.element);
        const closeBtn = me.renderer.getCloseButton(me.element);

        if (moveHandle) me.renderer.off(moveHandle, 'pointerdown', me._boundOnGroupPointerDown);
        if (popoutBtn) me.renderer.off(popoutBtn, 'click', me._boundOnPopout);
        if (collapseBtn) me.renderer.off(collapseBtn, 'click', me._boundOnCollapse);
        if (closeBtn) me.renderer.off(closeBtn, 'click', me._boundOnClose);
    }

    /**
     * Implementation of mount logic.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        super._doMount(container);

        me._attachListeners();

        const tabSlot = me.renderer.getTabContainerSlot(me.element);
        if (tabSlot) {
            me.tabStrip.mount(tabSlot);
        }

        if (me.tabStrip.onSimpleModeChange) {
            me.tabStrip.onSimpleModeChange(isSimple => {
                me.renderer.setSimpleMode(me.element, isSimple);
            });

            me.renderer.setSimpleMode(me.element, me.tabStrip.isSimpleModeActive);
        }

        me._syncVisibility();
    }

    /**
     * Syncs the initial visibility configuration from the panel group to the header.
     *
     * @private
     * @returns {void}
     */
    _syncVisibility() {
        const me = this;
        if (!me.panelGroup) return;

        const isPopout = me.panelGroup.isPopout;

        if (isPopout) {
            me.updateConfig({
                closable: false,
                collapsible: false,
                movable: true
            });
        } else {
            me.updateConfig({
                closable: me.panelGroup.closable,
                collapsible: me.panelGroup.collapsible,
                movable: me.panelGroup.movable
            });
        }

        me.setPopoutState(isPopout);
    }

    /**
     * Implementation of unmount logic.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;

        me._detachListeners();

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
     * Handler for popout button click.
     *
     * @private
     * @returns {void}
     */
    _onPopout() {
        const me = this;
        if (!me.panelGroup) return;

        const popoutService = PopoutManagerService.getInstance();

        if (me.panelGroup.isPopout) {
            popoutService.returnGroup(me.panelGroup);
        } else {
            popoutService.popoutGroup(me.panelGroup);
        }
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
        const title = me.panelGroup && me.panelGroup.title ? me.panelGroup.title : 'Group';
        if (me.element) {
            me.renderer.updateAriaLabels(me.element, title);
        }
    }

    /**
     * Updates the visual state of the popout button.
     *
     * @param {boolean} isPopout - Whether the group is currently popped out.
     * @returns {void}
     */
    setPopoutState(isPopout) {
        const me = this;
        if (me.element) {
            me.renderer.setPopoutState(me.element, Boolean(isPopout));
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
     * @param {boolean} [config.collapsible] - Whether to show the collapse button.
     * @param {boolean} [config.popout] - (Optional) Whether to show the popout button.
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
        if (config.collapsible !== undefined) {
            me.renderer.setCollapseButtonVisibility(me.element, config.collapsible);
        }
        if (config.popout !== undefined) {
            me.renderer.setPopoutButtonVisibility(me.element, config.popout);
        }
    }
}
