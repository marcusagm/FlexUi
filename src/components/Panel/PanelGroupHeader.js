import { appBus } from '../../utils/EventBus.js';

/**
 * Description:
 * Manages the header element of a PanelGroup.
 * This class provides the group-level controls (Move, Collapse, Close)
 * and the 'tabContainer' where child PanelHeaders (tabs) are inserted
 * by the parent PanelGroup. It also handles tab scrolling logic.
 *
 * Properties summary:
 * - _state {object} : Internal state.
 * - _resizeObserver {ResizeObserver | null} : Observes the tabContainer for scrolling.
 * - panelGroup {PanelGroup} : Reference to the parent PanelGroup.
 * - element {HTMLElement} : The main header element.
 * - tabContainer {HTMLElement} : The DOM node where tabs are injected.
 *
 * Typical usage:
 * // Instantiated by PanelGroup.js
 * this._state.header = new PanelGroupHeader(this);
 *
 * Events:
 * - Emits (appBus): 'panel:toggle-collapse-request'
 * - Emits (appBus): 'panel:close-request'
 * - Emits (appBus): 'dragstart' (for the *entire group* via Pointer)
 *
 * Dependencies:
 * - ../../utils/EventBus.js
 */
export class PanelGroupHeader {
    /**
     * @type {{title: string | null}}
     * @private
     */
    _state = {
        title: null
    };

    /**
     * Observes the tabContainer to show/hide scroll buttons.
     * @type {ResizeObserver | null}
     * @private
     */
    _resizeObserver = null;

    /**
     * @param {import('./PanelGroup.js').PanelGroup} panelGroup - The parent PanelGroup instance.
     */
    constructor(panelGroup) {
        const me = this;
        me.panelGroup = panelGroup;
        me.element = document.createElement('div');
        me.element.classList.add('panel-group__header');

        me.element.dropZoneInstance = me.panelGroup;
        me.element.dataset.dropzone = me.panelGroup.dropZoneType;

        me.build();
        me._initResizeObserver();
    }

    /**
     * Builds the DOM elements for the header.
     * @returns {void}
     */
    build() {
        const me = this;
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
            appBus.emit('panel:toggle-collapse-request', me.panelGroup);
        });

        me.closeBtn = document.createElement('button');
        me.closeBtn.type = 'button';
        me.closeBtn.classList.add('panel-group__close-btn', 'panel__close-btn');
        me.closeBtn.addEventListener('click', () => {
            appBus.emit('panel:close-request', me.panelGroup);
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
     * @returns {void}
     */
    updateAriaLabels() {
        const me = this;
        const title = me.panelGroup._state.title;
        me.moveHandle.setAttribute('aria-label', `Mover grupo ${title}`);
        me.collapseBtn.setAttribute('aria-label', `Recolher grupo ${title}`);
        me.closeBtn.setAttribute('aria-label', `Fechar grupo ${title}`);
    }

    /**
     * Handles drag start for the *entire group*.
     * @param {PointerEvent} e
     * @returns {void}
     */
    onGroupPointerDown(e) {
        const me = this;
        if (e.button !== 0) return;

        if (!me.panelGroup._state.movable) return;

        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        target.setPointerCapture(e.pointerId);

        const dragElement = me.panelGroup.element;
        const rect = dragElement.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        appBus.emit('dragstart', {
            item: me.panelGroup,
            type: 'PanelGroup',
            element: dragElement,
            event: e,
            offsetX: offsetX,
            offsetY: offsetY
        });
    }
}
