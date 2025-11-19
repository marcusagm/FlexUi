import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Manages the header element of a PanelGroup.
 * This class provides the group-level controls (Move, Collapse, Close)
 * and the 'tabContainer' where child PanelHeaders (tabs) are inserted
 * by the parent PanelGroup. It also handles tab scrolling logic.
 *
 * Properties summary:
 * - panelGroup {PanelGroup} : Reference to the parent PanelGroup.
 * - title {string} : The title used for ARIA labels.
 * - element {HTMLElement} : The main header element.
 * - tabContainer {HTMLElement} : The DOM node where tabs are injected.
 * - moveHandle {HTMLElement} : The drag handle element.
 * - scrollLeftBtn {HTMLElement} : Button to scroll tabs left.
 * - scrollRightBtn {HTMLElement} : Button to scroll tabs right.
 * - collapseBtn {HTMLElement} : Button to toggle collapse state.
 * - closeBtn {HTMLElement} : Button to close the group.
 *
 * Events:
 * - Emits (appBus): EventTypes.PANEL_TOGGLE_COLLAPSE, EventTypes.PANEL_CLOSE_REQUEST
 * - Emits (appBus): EventTypes.DND_DRAG_START (for the *entire group* via Pointer)
 *
 * Dependencies:
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../constants/EventTypes.js').EventTypes}
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
     * Observes the tabContainer to show/hide scroll buttons.
     *
     * @type {ResizeObserver | null}
     * @private
     */
    _resizeObserver = null;

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
     * Button to scroll tabs left.
     *
     * @type {HTMLElement}
     * @public
     */
    scrollLeftBtn;

    /**
     * The DOM node where tabs are injected.
     *
     * @type {HTMLElement}
     * @public
     */
    tabContainer;

    /**
     * Button to scroll tabs right.
     *
     * @type {HTMLElement}
     * @public
     */
    scrollRightBtn;

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
     * Creates a new PanelGroupHeader instance.
     *
     * @param {import('./PanelGroup.js').PanelGroup} panelGroup - The parent PanelGroup instance.
     */
    constructor(panelGroup) {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('panel-group__header');

        me.panelGroup = panelGroup;

        me.build();
        me._initResizeObserver();
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
     * Validates that the value is an object or null.
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
        const me = this;
        return me._title;
    }

    /**
     * Sets the title.
     * Validates that the value is a string or null.
     *
     * @param {string | null} value - The new title.
     * @returns {void}
     */
    set title(value) {
        if (value !== null && typeof value !== 'string') {
            console.warn(
                `[PanelGroupHeader] Invalid title assignment (${value}). Must be a string or null.`
            );
            return;
        }
        this._title = value;
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

        me.moveHandle = document.createElement('div');
        me.moveHandle.classList.add('panel-group__move-handle', 'panel__move-handle');

        // Pointer events for Drag
        me.moveHandle.style.touchAction = 'none';
        me.moveHandle.addEventListener('pointerdown', me.onGroupPointerDown.bind(me));

        me.moveHandle.setAttribute('role', 'button');

        const iconElement = document.createElement('span');
        iconElement.className = 'icon icon-handle';
        me.moveHandle.appendChild(iconElement);

        me.scrollLeftBtn = document.createElement('button');
        me.scrollLeftBtn.type = 'button';
        me.scrollLeftBtn.classList.add('panel-group__tab-scroll', 'panel-group__tab-scroll--left');
        me.scrollLeftBtn.textContent = '<';
        me.scrollLeftBtn.style.display = 'none';

        me.tabContainer = document.createElement('div');
        me.tabContainer.classList.add('panel-group__tab-container');

        me.scrollRightBtn = document.createElement('button');
        me.scrollRightBtn.type = 'button';
        me.scrollRightBtn.classList.add(
            'panel-group__tab-scroll',
            'panel-group__tab-scroll--right'
        );
        me.scrollRightBtn.textContent = '>';
        me.scrollRightBtn.style.display = 'none';

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

        me.element.append(
            me.moveHandle,
            me.scrollLeftBtn,
            me.tabContainer,
            me.scrollRightBtn,
            me.collapseBtn,
            me.closeBtn
        );

        me.scrollLeftBtn.addEventListener('click', () =>
            me.tabContainer.scrollBy({ left: -100, behavior: 'smooth' })
        );
        me.scrollRightBtn.addEventListener('click', () =>
            me.tabContainer.scrollBy({ left: 100, behavior: 'smooth' })
        );
        me.tabContainer.addEventListener('scroll', me.updateScrollButtons.bind(me));
    }

    /**
     * Initializes the ResizeObserver for the tab container.
     *
     * @private
     * @returns {void}
     */
    _initResizeObserver() {
        const me = this;
        me._resizeObserver = new ResizeObserver(me.updateScrollButtons.bind(me));
        me._resizeObserver.observe(me.tabContainer);
    }

    /**
     * Cleans up the observer to prevent memory leaks.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._resizeObserver) {
            me._resizeObserver.disconnect();
        }
    }

    /**
     * Shows or hides tab scroll buttons based on overflow.
     *
     * @returns {void}
     */
    updateScrollButtons() {
        const me = this;
        const { scrollLeft, scrollWidth, clientWidth } = me.tabContainer;
        const showLeft = scrollLeft > 1;
        const showRight = scrollWidth > clientWidth + 1;
        me.scrollLeftBtn.style.display = showLeft ? '' : 'none';
        me.scrollRightBtn.style.display = showRight ? '' : 'none';
    }

    /**
     * Updates ARIA labels for group control buttons.
     * Uses the title from the parent PanelGroup state provisionally.
     *
     * @returns {void}
     */
    updateAriaLabels() {
        const me = this;
        // Provisional access to parent state until PanelGroup is fully refactored.
        // We fall back to a default title if none is available.
        const title = me.panelGroup && me.panelGroup._state ? me.panelGroup._state.title : 'Grupo';

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

        if (!me.panelGroup || !me.panelGroup._state.movable) return;

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
