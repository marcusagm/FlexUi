import { appBus } from '../../utils/EventBus.js';
import { ContextMenuService } from '../../services/ContextMenu/ContextMenuService.js';

/**
 * Description:
 * Represents the header/tab component of a single Panel.
 * This class is a self-contained DOM component owned by a Panel.
 * It renders the UI for the "tab" and acts as the drag source
 * for DND operations involving the Panel using Pointer Events.
 *
 * It implements a "Drag Threshold" to distinguish between a click (to activate)
 * and a drag (to move/undock).
 *
 * Properties summary:
 * - _state {object} : Manages references to its parent Panel and PanelGroup.
 * - element {HTMLElement} : The main DOM element (<div class="panel-group__tab">).
 * - _titleEl {HTMLElement} : The <span> element for the title.
 * - _closeBtn {HTMLElement} : The <button> element for the close button.
 * - _dragThreshold {number} : Pixels mouse must move to trigger drag start.
 * - _dragStartData {object|null} : Temporary storage for pointerdown data.
 *
 * Typical usage:
 * // Instantiated by Panel.js
 * this._state.header = new PanelHeader(this, panelTitle);
 *
 * Events:
 * - Emits (appBus): 'dragstart'
 * - Emits (appBus): 'panel:group-child-close-request'
 *
 * Dependencies:
 * - ../../utils/EventBus.js
 * - ../../services/ContextMenu/ContextMenuService.js
 */
export class PanelHeader {
    /**
     * @type {{
     * title: string | null,
     * panel: import('./Panel.js').Panel | null,
     * parentGroup: import('./PanelGroup.js').PanelGroup | null
     * }}
     * @private
     */
    _state = {
        title: null,
        panel: null,
        parentGroup: null
    };

    /**
     * The main DOM element (the tab: .panel-group__tab)
     * @type {HTMLElement}
     * @public
     */
    element;

    /**
     * The <span> element holding the title text.
     * @type {HTMLElement}
     * @private
     */
    _titleEl;

    /**
     * The close <button> element.
     * @type {HTMLElement}
     * @private
     */
    _closeBtn;

    /**
     * Minimum pixels to move before drag starts.
     * @type {number}
     * @private
     */
    _dragThreshold = 5;

    /**
     * Temporary data stored during the "pending drag" state.
     * @type {object|null}
     * @private
     */
    _dragStartData = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnPointerDown = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundCheckDragMove = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundCheckDragUp = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnCloseClick = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnTabClick = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnContextMenu = null;

    /**
     * @param {import('./Panel.js').Panel} panel - The parent Panel instance.
     * @param {string} title - The initial title.
     */
    constructor(panel, title) {
        const me = this;
        me._state.panel = panel;
        me._state.title = title;
        me.element = document.createElement('div');

        me._boundOnPointerDown = me.onPointerDown.bind(me);
        me._boundCheckDragMove = me._onCheckDragMove.bind(me);
        me._boundCheckDragUp = me._onCheckDragUp.bind(me);

        me._boundOnCloseClick = me.onCloseClick.bind(me);
        me._boundOnTabClick = me.onTabClick.bind(me);
        me._boundOnContextMenu = me.onContextMenu.bind(me);

        me.build();
        me.initEventListeners();
        me.updateConfig(panel._state);
    }

    /**
     * Builds the DOM for the tab.
     * @returns {void}
     */
    build() {
        const me = this;
        me.element.classList.add('panel-group__tab');

        // Touch-action none is important for pointer events handling
        me.element.style.touchAction = 'none';

        // Default draggable state (can be overridden by updateConfig/setMode)
        me.element.draggable = true;

        me._titleEl = document.createElement('span');
        me._titleEl.classList.add('panel__title');
        me._titleEl.textContent = me._state.title || 'Sem Título';
        me.element.appendChild(me._titleEl);

        me._closeBtn = document.createElement('button');
        me._closeBtn.type = 'button';
        me._closeBtn.classList.add('panel-group__tab-close');
        me._closeBtn.textContent = '×';
        me.element.appendChild(me._closeBtn);
    }

    /**
     * Initializes DND (pointer) and click listeners.
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        me.element.addEventListener('pointerdown', me._boundOnPointerDown);
        me._closeBtn.addEventListener('click', me._boundOnCloseClick);
        me.element.addEventListener('click', me._boundOnTabClick);
        me.element.addEventListener('contextmenu', me._boundOnContextMenu);
    }

    /**
     * Removes event listeners to prevent memory leaks.
     * @returns {void}
     */
    destroy() {
        const me = this;
        me.element.removeEventListener('pointerdown', me._boundOnPointerDown);
        me._closeBtn.removeEventListener('click', me._boundOnCloseClick);
        me.element.removeEventListener('click', me._boundOnTabClick);
        me.element.removeEventListener('contextmenu', me._boundOnContextMenu);

        // Clean up transient listeners if destroyed while pending
        if (me._dragStartData) {
            window.removeEventListener('pointermove', me._boundCheckDragMove);
            window.removeEventListener('pointerup', me._boundCheckDragUp);
            window.removeEventListener('pointercancel', me._boundCheckDragUp);
            me._dragStartData = null;
        }
    }

    /**
     * Handles the initial pointer down.
     * Sets up monitoring to detect if this is a click or a drag start.
     * @param {PointerEvent} e
     * @returns {void}
     */
    onPointerDown(e) {
        const me = this;

        // 1. Only left click or touch
        if (e.button !== 0) return;

        // 2. Check if draggable is enabled
        if (!me.element.draggable) return;

        // 3. Ignore if clicking the close button
        if (e.target.closest('.panel-group__tab-close')) return;

        e.preventDefault(); // Prevent default selection/scroll
        e.stopPropagation();

        const target = e.target;
        target.setPointerCapture(e.pointerId);

        // Store initial data to check threshold later
        me._dragStartData = {
            startX: e.clientX,
            startY: e.clientY,
            pointerId: e.pointerId,
            target: target,
            event: e // Keep original event for payload
        };

        // Attach transient global listeners
        window.addEventListener('pointermove', me._boundCheckDragMove);
        window.addEventListener('pointerup', me._boundCheckDragUp);
        window.addEventListener('pointercancel', me._boundCheckDragUp);
    }

    /**
     * Checks if the mouse moved enough to qualify as a drag.
     * @param {PointerEvent} e
     * @private
     */
    _onCheckDragMove(e) {
        const me = this;
        if (!me._dragStartData || e.pointerId !== me._dragStartData.pointerId) return;

        const dx = Math.abs(e.clientX - me._dragStartData.startX);
        const dy = Math.abs(e.clientY - me._dragStartData.startY);

        // If moved beyond threshold, Start Drag
        if (dx > me._dragThreshold || dy > me._dragThreshold) {
            me._startDrag(e);
        }
    }

    /**
     * Called if pointer is released BEFORE drag threshold is met.
     * Treats the action as a Click (activates the tab).
     * @param {PointerEvent} e
     * @private
     */
    _onCheckDragUp(e) {
        const me = this;
        if (!me._dragStartData || e.pointerId !== me._dragStartData.pointerId) return;

        // Cleanup listeners
        me._cleanupPendingDrag();

        // Since we called preventDefault on pointerdown, native click might be suppressed.
        // We manually trigger the tab activation logic here.
        if (me._state.parentGroup) {
            me._state.parentGroup.setActive(me._state.panel);
        }
    }

    /**
     * Cleans up temporary listeners and data for pending drag.
     * @private
     */
    _cleanupPendingDrag() {
        const me = this;
        if (me._dragStartData) {
            if (me._dragStartData.target) {
                me._dragStartData.target.releasePointerCapture(me._dragStartData.pointerId);
            }
            window.removeEventListener('pointermove', me._boundCheckDragMove);
            window.removeEventListener('pointerup', me._boundCheckDragUp);
            window.removeEventListener('pointercancel', me._boundCheckDragUp);
            me._dragStartData = null;
        }
    }

    /**
     * Actually emits the dragstart event to the DragDropService.
     * @param {PointerEvent} e
     * @private
     */
    _startDrag(e) {
        const me = this;

        // Calculate offset based on the original pointerdown position
        const rect = me.element.getBoundingClientRect();
        // We use the CURRENT event coordinates for the start position logic in DDS,
        // but offset is usually calculated relative to the element's top-left.
        // Let's use the current pointer to ensure smoothness.
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        // Retrieve stored event to pass (or use current)
        // const originalEvent = me._dragStartData.event;

        // Cleanup local monitoring, handover to DragDropService
        me._cleanupPendingDrag();

        appBus.emit('dragstart', {
            item: me._state.panel,
            type: 'Panel',
            element: me.element,
            event: e,
            offsetX: offsetX,
            offsetY: offsetY
        });
    }

    /**
     * Handles clicks on the tab's close (X) button.
     * @param {MouseEvent} e
     * @returns {void}
     */
    onCloseClick(e) {
        e.stopPropagation();
        const me = this;

        if (!me._state.panel._state.closable) return;

        if (me._state.parentGroup) {
            appBus.emit('panel:group-child-close-request', {
                panel: me._state.panel,
                group: me._state.parentGroup
            });
        }
    }

    /**
     * Handles clicks on the tab to activate it.
     * (Kept for compatibility, but onPointerDown logic usually supercedes this for left clicks)
     * @param {MouseEvent} e
     * @returns {void}
     */
    onTabClick(e) {
        const me = this;
        // This might still fire for middle/right clicks or if preventDefault wasn't called
        if (me._state.parentGroup) {
            me._state.parentGroup.setActive(me._state.panel);
        }
    }

    /**
     * Handles the context menu (right-click) event on the tab.
     * @param {MouseEvent} e
     * @returns {void}
     */
    onContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();

        const me = this;
        const panelState = me._state.panel._state;
        const menuItems = [
            {
                title: 'Desacoplar Painel',
                event: 'app:undock-panel-request',
                disabled: !panelState.movable || panelState.parentGroup._state.isFloating
            },
            { isSeparator: true },
            {
                title: 'Fechar Aba',
                event: 'app:close-panel-request',
                disabled: !panelState.closable
            }
        ];

        const contextData = {
            panel: me._state.panel,
            group: me._state.parentGroup,
            nativeEvent: e
        };

        ContextMenuService.getInstance().show(e, menuItems, contextData);
    }

    /**
     * <ParentGroup> setter.
     * @param {import('./PanelGroup.js').PanelGroup} group - The parent PanelGroup.
     * @returns {void}
     */
    setParentGroup(group) {
        this._state.parentGroup = group;
    }

    /**
     * Updates the title text in the DOM.
     * @param {string} title
     * @returns {void}
     */
    setTitle(title) {
        this._state.title = title;
        this._titleEl.textContent = title;
    }

    /**
     * Updates the UI based on the Panel's configuration (e.g., from fromJSON).
     * @param {object} config - { closable, movable }
     * @returns {void}
     */
    updateConfig(config) {
        const me = this;
        if (config.closable === false) {
            me._closeBtn.style.display = 'none';
        } else {
            me._closeBtn.style.display = '';
        }

        if (config.movable === false) {
            me.element.draggable = false; // Used as logic flag
            me.element.style.cursor = 'default';
        } else {
            me.element.draggable = true;
            me.element.style.cursor = 'grab';
        }
    }

    /**
     * Toggles the visual appearance between 'simple' (header) and 'tab' mode.
     * Also manages the draggable state logic.
     * @param {boolean} isSimpleMode
     * @returns {void}
     */
    setMode(isSimpleMode) {
        const me = this;
        if (isSimpleMode) {
            me.element.classList.remove('panel-group__tab');
            me._closeBtn.style.display = 'none';

            // Single panel mode: Disable tab dragging
            me.element.draggable = false;
            me.element.style.cursor = 'default';
        } else {
            me.element.classList.add('panel-group__tab');
            if (me._state.panel._state.closable) {
                me._closeBtn.style.display = '';
            }

            // Multi panel mode: Restore draggable based on config
            if (me._state.panel._state.movable) {
                me.element.draggable = true;
                me.element.style.cursor = 'grab';
            } else {
                me.element.draggable = false;
                me.element.style.cursor = 'default';
            }
        }
    }
}
