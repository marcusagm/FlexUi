import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { TabStrip } from '../Core/TabStrip.js';
import { UIElement } from '../../core/UIElement.js';

/**
 * Description:
 * A wrapper class to adapt the legacy PanelHeader (which is not a UIElement)
 * to the UIElement interface required by TabStrip.
 * This ensures compatibility without refactoring PanelHeader immediately.
 *
 * @internal
 */
class PanelHeaderWrapper extends UIElement {
    constructor(panelHeader) {
        super();
        this.panelHeader = panelHeader;
    }

    _doRender() {
        return this.panelHeader.element;
    }

    get element() {
        return this.panelHeader.element;
    }
}

/**
 * Description:
 * Manages the header element of a PanelGroup.
 * This class provides the group-level controls (Move, Collapse, Close)
 * and integrates the TabStrip component to manage the tabs.
 *
 * Properties summary:
 * - panelGroup {PanelGroup} : Reference to the parent PanelGroup.
 * - title {string} : The title used for ARIA labels.
 * - element {HTMLElement} : The main header element.
 * - moveHandle {HTMLElement} : The drag handle element.
 * - collapseBtn {HTMLElement} : Button to toggle collapse state.
 * - closeBtn {HTMLElement} : Button to close the group.
 * - tabStrip {TabStrip} : The component managing the list of tabs.
 * - _tabsWrapper {HTMLElement} : The DOM container for the TabStrip.
 *
 * Events:
 * - Emits (appBus): EventTypes.PANEL_TOGGLE_COLLAPSE, EventTypes.PANEL_CLOSE_REQUEST
 * - Emits (appBus): EventTypes.DND_DRAG_START (for the *entire group* via Pointer)
 *
 * Dependencies:
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../constants/EventTypes.js').EventTypes}
 * - {import('../Core/TabStrip.js').TabStrip}
 */
export class PanelGroupHeader {
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
     * The main header element.
     *
     * @type {HTMLElement}
     * @public
     */
    element;

    /**
     * The drag handle element.
     *
     * @type {HTMLElement}
     * @public
     */
    moveHandle;

    /**
     * Button to toggle collapse state.
     *
     * @type {HTMLElement}
     * @public
     */
    collapseBtn;

    /**
     * Button to close the group.
     *
     * @type {HTMLElement}
     * @public
     */
    closeBtn;

    /**
     * The TabStrip component instance.
     *
     * @type {TabStrip}
     * @public
     */
    tabStrip;

    /**
     * The DOM wrapper for the TabStrip.
     *
     * @type {HTMLElement}
     * @private
     */
    _tabsWrapper;

    /**
     * Creates a new PanelGroupHeader instance.
     *
     * @param {import('./PanelGroup.js').PanelGroup} panelGroup - The parent PanelGroup instance.
     */
    constructor(panelGroup) {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('panel-group__header');

        me.panelGroup = panelGroup;

        // Initialize TabStrip with Simple Mode enabled
        me.tabStrip = new TabStrip(panelGroup.id + '-tabs', {
            orientation: 'horizontal',
            simpleMode: true
        });

        me.build();
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
    }

    /**
     * Builds the DOM elements for the header.
     *
     * @returns {void}
     */
    build() {
        const me = this;

        // Link DND properties from the parent group
        if (me.panelGroup) {
            me.element.dropZoneInstance = me.panelGroup;
            me.element.dataset.dropzone = me.panelGroup.dropZoneType;
        }

        // 1. Move Handle
        me.moveHandle = document.createElement('div');
        me.moveHandle.classList.add('panel-group__move-handle', 'panel__move-handle');
        me.moveHandle.style.touchAction = 'none';
        me.moveHandle.addEventListener('pointerdown', me.onGroupPointerDown.bind(me));
        me.moveHandle.setAttribute('role', 'button');

        const iconElement = document.createElement('span');
        iconElement.className = 'icon icon-handle';
        me.moveHandle.appendChild(iconElement);

        // 2. Tabs Wrapper (Container for TabStrip)
        me._tabsWrapper = document.createElement('div');
        // Mimic old tab container styles for layout
        me._tabsWrapper.className = 'panel-group__tab-container';
        me._tabsWrapper.style.overflow = 'hidden'; // Let TabStrip handle overflow internally

        // Mount TabStrip into wrapper
        me.tabStrip.mount(me._tabsWrapper);

        // 3. Controls (Collapse, Close)
        me.collapseBtn = document.createElement('button');
        me.collapseBtn.type = 'button';
        me.collapseBtn.classList.add('panel-group__collapse-btn', 'panel__collapse-btn');
        me.collapseBtn.addEventListener('click', () => {
            if (me.panelGroup) {
                appBus.emit(EventTypes.PANEL_TOGGLE_COLLAPSE, me.panelGroup);
            }
        });

        me.closeBtn = document.createElement('button');
        me.closeBtn.type = 'button';
        me.closeBtn.classList.add('panel-group__close-btn', 'panel__close-btn');
        me.closeBtn.addEventListener('click', () => {
            if (me.panelGroup) {
                appBus.emit(EventTypes.PANEL_CLOSE_REQUEST, me.panelGroup);
            }
        });

        // Append in order
        me.element.append(me.moveHandle, me._tabsWrapper, me.collapseBtn, me.closeBtn);
    }

    /**
     * Creates a UIElement wrapper for a PanelHeader to be added to the TabStrip.
     *
     * @param {object} panelHeader - The legacy PanelHeader instance.
     * @returns {UIElement} The wrapped element.
     */
    createTabWrapper(panelHeader) {
        return new PanelHeaderWrapper(panelHeader);
    }

    /**
     * Cleans up the component and destroys the TabStrip.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me.tabStrip) {
            me.tabStrip.dispose();
        }
        me.element.remove();
    }

    /**
     * Proxy method to update scroll buttons (handled by TabStrip now).
     * Kept for potential API compatibility if external calls exist, though likely unused.
     *
     * @returns {void}
     */
    updateScrollButtons() {
        // No-op: TabStrip handles this internally via ResizeObserver
    }

    /**
     * Updates ARIA labels for group control buttons.
     *
     * @returns {void}
     */
    updateAriaLabels() {
        const me = this;
        const title = me.panelGroup && me.panelGroup.title ? me.panelGroup.title : 'Grupo';

        me.moveHandle.setAttribute('aria-label', `Mover grupo ${title}`);
        me.collapseBtn.setAttribute('aria-label', `Recolher grupo ${title}`);
        me.closeBtn.setAttribute('aria-label', `Fechar grupo ${title}`);
    }

    /**
     * Handles drag start for the *entire group*.
     *
     * @param {PointerEvent} event - The pointerdown event.
     * @returns {void}
     */
    onGroupPointerDown(event) {
        const me = this;
        if (event.button !== 0) return;

        if (!me.panelGroup || !me.panelGroup.movable) return;

        event.preventDefault();
        event.stopPropagation();

        const target = event.target;
        target.setPointerCapture(event.pointerId);

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
}
