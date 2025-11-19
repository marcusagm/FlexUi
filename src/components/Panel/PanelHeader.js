import { appBus } from '../../utils/EventBus.js';
import { ContextMenuService } from '../../services/ContextMenu/ContextMenuService.js';
import { DragTrigger } from '../../utils/DragTrigger.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Represents the header/tab component of a single Panel.
 * This class is a self-contained DOM component owned by a Panel.
 * It renders the UI for the "tab" and acts as the drag source
 * for DND operations involving the Panel using Pointer Events.
 *
 * It utilizes DragTrigger to distinguish between a click (to activate)
 * and a drag (to move/undock).
 *
 * Properties summary:
 * - _title {string|null} : The text displayed in the tab.
 * - _panel {Panel|null} : The parent Panel instance.
 * - _parentGroup {PanelGroup|null} : The PanelGroup this panel belongs to.
 * - element {HTMLElement} : The main DOM element (<div class="panel-group__tab">).
 * - _titleEl {HTMLElement} : The <span> element holding the title text.
 * - _closeBtn {HTMLElement} : The close <button> element.
 * - _dragTrigger {DragTrigger} : Utility to handle drag/click detection.
 *
 * Typical usage:
 * // Instantiated by Panel.js
 * this._header = new PanelHeader(this, 'My Title');
 * this._header.setParentGroup(someGroup);
 *
 * Events:
 * - Emits (appBus): EventTypes.DND_DRAG_START - When dragging starts.
 * - Emits (appBus): EventTypes.PANEL_GROUP_CHILD_CLOSE - When close button is clicked.
 *
 * Business rules implemented:
 * - Distinguishes between a "Click" (to activate tab) and "Drag" (to move panel) using DragTrigger.
 * - Stops propagation on the close button to prevent activating/dragging when closing.
 * - Shows a context menu on right-click with options to Undock or Close.
 * - Updates visibility of close button based on Panel configuration.
 * - Manages the draggable attribute based on configuration.
 *
 * Dependencies:
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../services/ContextMenu/ContextMenuService.js').ContextMenuService}
 * - {import('../../utils/DragTrigger.js').DragTrigger}
 * - {import('../../constants/EventTypes.js').EventTypes}
 *
 * Notes / Additional:
 * - This component is tightly coupled with Panel and PanelGroup.
 */
export class PanelHeader {
    /**
     * The text displayed in the tab.
     *
     * @type {string | null}
     * @private
     */
    _title = null;

    /**
     * The parent Panel instance.
     *
     * @type {import('./Panel.js').Panel | null}
     * @private
     */
    _panel = null;

    /**
     * The PanelGroup this panel belongs to.
     *
     * @type {import('./PanelGroup.js').PanelGroup | null}
     * @private
     */
    _parentGroup = null;

    /**
     * The main DOM element (the tab: .panel-group__tab).
     *
     * @type {HTMLElement}
     * @public
     */
    element;

    /**
     * The <span> element holding the title text.
     *
     * @type {HTMLElement}
     * @private
     */
    _titleEl;

    /**
     * The close <button> element.
     *
     * @type {HTMLElement}
     * @private
     */
    _closeBtn;

    /**
     * Utility to handle drag/click detection.
     *
     * @type {DragTrigger}
     * @private
     */
    _dragTrigger;

    /**
     * Bound handler for the close button click event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnCloseClick = null;

    /**
     * Bound handler for the context menu event.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnContextMenu = null;

    /**
     * Creates a new PanelHeader instance.
     *
     * @param {import('./Panel.js').Panel} panel - The parent Panel instance.
     * @param {string} title - The initial title.
     */
    constructor(panel, title) {
        const me = this;
        me.element = document.createElement('div');

        me._boundOnCloseClick = me.onCloseClick.bind(me);
        me._boundOnContextMenu = me.onContextMenu.bind(me);

        me.build();

        // Initialize properties via setters
        me.panel = panel;
        me.title = title;

        me.initEventListeners();

        // Initialize DragTrigger
        me._dragTrigger = new DragTrigger(me.element, {
            threshold: 5,
            onDragStart: (event, startCoords) => me._startDrag(event, startCoords),
            onClick: event => me.onTabClick(event)
        });
    }

    /**
     * Retrieves the current title.
     *
     * @returns {string | null} The title text.
     */
    get title() {
        const me = this;
        return me._title;
    }

    /**
     * Sets the title and updates the DOM element.
     * Validates that the value is a string or null.
     *
     * @param {string | null} value - The new title.
     * @returns {void}
     */
    set title(value) {
        const me = this;
        if (value !== null && typeof value !== 'string') {
            console.warn(
                `[PanelHeader] Invalid title assignment (${value}). Must be a string or null.`
            );
            return;
        }
        me._title = value;

        if (me._titleEl) {
            me._titleEl.textContent = value || 'No title';
        }
    }

    /**
     * Retrieves the parent Panel instance.
     *
     * @returns {import('./Panel.js').Panel | null} The panel instance.
     */
    get panel() {
        const me = this;
        return me._panel;
    }

    /**
     * Sets the parent Panel instance.
     * Validates that the value is an object (Panel instance) or null.
     *
     * @param {import('./Panel.js').Panel | null} value - The new panel instance.
     * @returns {void}
     */
    set panel(value) {
        const me = this;
        if (value !== null && typeof value !== 'object') {
            console.warn(
                `[PanelHeader] Invalid panel assignment (${value}). Must be a Panel instance or null.`
            );
            return;
        }
        me._panel = value;
    }

    /**
     * Retrieves the parent PanelGroup instance.
     *
     * @returns {import('./PanelGroup.js').PanelGroup | null} The parent group.
     */
    get parentGroup() {
        const me = this;
        return me._parentGroup;
    }

    /**
     * Sets the parent PanelGroup instance.
     * Validates that the value is an object (PanelGroup instance) or null.
     *
     * @param {import('./PanelGroup.js').PanelGroup | null} value - The new parent group.
     * @returns {void}
     */
    set parentGroup(value) {
        const me = this;
        if (value !== null && typeof value !== 'object') {
            console.warn(
                `[PanelHeader] Invalid parentGroup assignment (${value}). Must be a PanelGroup instance or null.`
            );
            return;
        }
        me._parentGroup = value;
    }

    /**
     * Builds the DOM for the tab.
     *
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
        me.element.appendChild(me._titleEl);

        me._closeBtn = document.createElement('button');
        me._closeBtn.type = 'button';
        me._closeBtn.classList.add('panel-group__tab-close');
        me._closeBtn.textContent = '×';

        // Important: Stop propagation on pointerdown to prevent DragTrigger
        // from starting a drag when the user intends to click the close button.
        me._closeBtn.addEventListener('pointerdown', event => event.stopPropagation());

        me.element.appendChild(me._closeBtn);
    }

    /**
     * Initializes context menu and close button listeners.
     * Note: Drag/Click on the main element is handled by DragTrigger.
     *
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        me._closeBtn.addEventListener('click', me._boundOnCloseClick);
        me.element.addEventListener('contextmenu', me._boundOnContextMenu);
    }

    /**
     * Removes event listeners to prevent memory leaks.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        me._closeBtn.removeEventListener('click', me._boundOnCloseClick);
        me.element.removeEventListener('contextmenu', me._boundOnContextMenu);

        if (me._dragTrigger) {
            me._dragTrigger.destroy();
            me._dragTrigger = null;
        }
    }

    /**
     * Actually emits the dragstart event to the DragDropService.
     *
     * @param {PointerEvent} event - The pointer event that triggered the drag start.
     * @param {object} startCoords - { startX, startY } from DragTrigger indicating the pointerdown position.
     * @private
     * @returns {void}
     */
    _startDrag(event, startCoords) {
        const me = this;

        // Calculate offset based on the original pointerdown position (startX/Y)
        // to insure the ghost element is positioned correctly relative to the cursor.
        const rect = me.element.getBoundingClientRect();
        const offsetX = startCoords.startX - rect.left;
        const offsetY = startCoords.startY - rect.top;

        appBus.emit(EventTypes.DND_DRAG_START, {
            item: me.panel,
            type: 'Panel',
            element: me.element,
            event: event,
            offsetX: offsetX,
            offsetY: offsetY
        });
    }

    /**
     * Handles clicks on the tab's close (X) button.
     *
     * @param {MouseEvent} event - The mouse click event.
     * @returns {void}
     */
    onCloseClick(event) {
        event.stopPropagation();
        const me = this;

        // Use public getter 'closable' from Panel
        if (!me.panel || !me.panel.closable) return;

        if (me.parentGroup) {
            appBus.emit(EventTypes.PANEL_GROUP_CHILD_CLOSE, {
                panel: me.panel,
                group: me.parentGroup
            });
        }
    }

    /**
     * Handles clicks on the tab to activate it.
     * Invoked by DragTrigger when the movement is below threshold.
     *
     * @param {MouseEvent} event - The mouse click event.
     * @returns {void}
     */
    onTabClick(event) {
        const me = this;
        if (me.parentGroup) {
            me.parentGroup.activePanel = me.panel; // Use setter
        }
    }

    /**
     * Handles the context menu (right-click) event on the tab.
     *
     * @param {MouseEvent} event - The native contextmenu event.
     * @returns {void}
     */
    onContextMenu(event) {
        event.preventDefault();
        event.stopPropagation();

        const me = this;
        const panel = me.panel;
        const parentGroup = me.parentGroup;

        const isMovable = panel ? panel.movable : false;
        const isClosable = panel ? panel.closable : false;
        const isFloating = parentGroup ? parentGroup.isFloating : false;

        const menuItems = [
            {
                title: 'Desacoplar Painel',
                event: EventTypes.APP_UNDOCK_PANEL_REQUEST,
                disabled: !isMovable || isFloating
            },
            { isSeparator: true },
            {
                title: 'Fechar Aba',
                event: EventTypes.APP_CLOSE_PANEL_REQUEST,
                disabled: !isClosable
            }
        ];

        const contextData = {
            panel: panel,
            group: parentGroup,
            nativeEvent: event
        };

        ContextMenuService.getInstance().show(event, menuItems, contextData);
    }

    /**
     * Wrapper for the parentGroup setter.
     *
     * @param {import('./PanelGroup.js').PanelGroup | null} group - The parent PanelGroup instance.
     * @returns {void}
     */
    setParentGroup(group) {
        this.parentGroup = group;
    }

    /**
     * Wrapper for the title setter.
     *
     * @param {string} title - The new title string.
     * @returns {void}
     */
    setTitle(title) {
        this.title = title;
    }

    /**
     * Updates the UI based on the Panel's configuration (e.g., closable, movable).
     *
     * @param {object} config - The panel configuration object ({ closable, movable }).
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
            // DragTrigger respects the attribute 'draggable'
            me.element.setAttribute('draggable', 'false');
            me.element.style.cursor = 'default';
        } else {
            me.element.setAttribute('draggable', 'true');
            me.element.style.cursor = 'grab';
        }
    }

    /**
     * Toggles the visual appearance between 'simple' (header) and 'tab' mode.
     * Also manages the draggable state logic via attributes.
     *
     * @param {boolean} isSimpleMode - True if rendering in single-panel mode.
     * @returns {void}
     */
    setMode(isSimpleMode) {
        const me = this;
        if (isSimpleMode) {
            me.element.classList.remove('panel-group__tab');
            me._closeBtn.style.display = 'none';

            // Single panel mode: Disable tab dragging
            me.element.setAttribute('draggable', 'false');
            me.element.style.cursor = 'default';
        } else {
            me.element.classList.add('panel-group__tab');

            // Check panel state for closable
            if (me.panel && me.panel.closable) {
                me._closeBtn.style.display = '';
            }

            // Multi panel mode: Restore draggable based on config
            if (me.panel && me.panel.movable) {
                me.element.setAttribute('draggable', 'true');
                me.element.style.cursor = 'grab';
            } else {
                me.element.setAttribute('draggable', 'false');
                me.element.style.cursor = 'default';
            }
        }
    }
}
