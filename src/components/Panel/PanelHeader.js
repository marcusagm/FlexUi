import { appBus } from '../../utils/EventBus.js';
import { ContextMenuService } from '../../services/ContextMenu/ContextMenuService.js';

/**
 * Description:
 * Represents the header/tab component of a single Panel.
 * This class is a self-contained DOM component owned by a Panel.
 * It renders the UI for the "tab" and acts as the drag source
 * for DND operations involving the Panel.
 *
 * Properties summary:
 * - _state {object} : Manages references to its parent Panel and PanelGroup.
 * - element {HTMLElement} : The main DOM element (<div class="panel-group__tab">).
 * - _titleEl {HTMLElement} : The <span> element for the title.
 * - _closeBtn {HTMLElement} : The <button> element for the close button.
 *
 * Typical usage:
 * // Instantiated by Panel.js
 * this._state.header = new PanelHeader(this, panelTitle);
 *
 * Events:
 * - Emits (DOM): 'dragstart', 'dragend', 'contextmenu'
 * - Emits (appBus): 'dragstart', 'dragend'
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
     * @type {Function | null}
     * @private
     */
    _boundOnDragStart = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnDragEnd = null;

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

        me._boundOnDragStart = me.onDragStart.bind(me);
        me._boundOnDragEnd = me.onDragEnd.bind(me);
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
     * Initializes DND (drag source) and click listeners.
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        me.element.addEventListener('dragstart', me._boundOnDragStart);
        me.element.addEventListener('dragend', me._boundOnDragEnd);
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
        me.element.removeEventListener('dragstart', me._boundOnDragStart);
        me.element.removeEventListener('dragend', me._boundOnDragEnd);
        me._closeBtn.removeEventListener('click', me._boundOnCloseClick);
        me.element.removeEventListener('click', me._boundOnTabClick);
        me.element.removeEventListener('contextmenu', me._boundOnContextMenu);
    }

    /**
     * Handles the start of a drag operation (drag source).
     * @param {DragEvent} e
     * @returns {void}
     */
    onDragStart(e) {
        e.stopPropagation();

        const me = this;
        if (!me._state.panel._state.movable) {
            e.preventDefault();
            return;
        }

        const rect = me.element.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

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
     * Handles the end of a drag operation.
     * @param {DragEvent} e
     * @returns {void}
     */
    onDragEnd(e) {
        e.stopPropagation();
        appBus.emit('dragend');
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
     * @param {MouseEvent} e
     * @returns {void}
     */
    onTabClick(e) {
        const me = this;
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
            me.element.draggable = false;
            me.element.style.cursor = 'default';
        } else {
            me.element.draggable = true;
            me.element.style.cursor = 'grab';
        }
    }

    /**
     * Toggles the visual appearance between 'simple' (header) and 'tab' mode.
     * Also manages the 'draggable' state.
     * @param {boolean} isSimpleMode
     * @returns {void}
     */
    setMode(isSimpleMode) {
        const me = this;
        if (isSimpleMode) {
            me.element.classList.remove('panel-group__tab');
            me._closeBtn.style.display = 'none';
            me.element.draggable = false;
            me.element.style.cursor = 'default';
        } else {
            me.element.classList.add('panel-group__tab');
            if (me._state.panel._state.closable) {
                me._closeBtn.style.display = '';
            }
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
