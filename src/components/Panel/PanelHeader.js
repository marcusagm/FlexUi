import { UIElement } from '../../core/UIElement.js';
import { VanillaPanelHeaderAdapter } from '../../renderers/vanilla/VanillaPanelHeaderAdapter.js';
import { appBus } from '../../utils/EventBus.js';
import { ContextMenuService } from '../../services/ContextMenu/ContextMenuService.js';
import { DragTrigger } from '../../utils/DragTrigger.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Represents the header/tab component of a single Panel.
 * This class is a controller that inherits from UIElement. It delegates
 * DOM rendering to an adapter and handles user interactions like clicking,
 * dragging (via DragTrigger), and context menus.
 *
 * Properties summary:
 * - panel {Panel} : The parent Panel instance.
 * - title {string} : The title text.
 * - parentGroup {PanelGroup} : The group containing this panel.
 *
 * Typical usage:
 * const header = new PanelHeader(panelInstance, 'My Title');
 * parentElement.appendChild(header.element); // Accessed via UIElement getter
 *
 * Events:
 * - Emits (appBus): EventTypes.DND_DRAG_START
 * - Emits (appBus): EventTypes.PANEL_GROUP_CHILD_CLOSE
 * - Emits (appBus): EventTypes.APP_UNDOCK_PANEL_REQUEST
 * - Emits (appBus): EventTypes.APP_CLOSE_PANEL_REQUEST
 *
 * Business rules implemented:
 * - Distinguishes between Click (activate tab) and Drag (move panel).
 * - Manages active state visuals via adapter.
 * - Shows/Hides close button based on configuration.
 * - Integrates with ContextMenuService for right-click actions.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaPanelHeaderAdapter.js').VanillaPanelHeaderAdapter}
 * - {import('../../utils/DragTrigger.js').DragTrigger}
 * - {import('../../utils/EventBus.js').appBus}
 */
export class PanelHeader extends UIElement {
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
     * Utility to handle drag/click detection.
     *
     * @type {DragTrigger | null}
     * @private
     */
    _dragTrigger = null;

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
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(panel, title, renderer = null) {
        super(null, renderer || new VanillaPanelHeaderAdapter());
        const me = this;

        me.panel = panel;
        me.title = title;

        me._boundOnCloseClick = me.onCloseClick.bind(me);
        me._boundOnContextMenu = me.onContextMenu.bind(me);

        // Initialize DOM via UIElement lifecycle
        me.render();
    }

    /**
     * Retrieves the current title.
     *
     * @returns {string | null} The title text.
     */
    get title() {
        return this._title;
    }

    /**
     * Sets the title and updates the DOM element via adapter.
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

        if (me.element) {
            me.renderer.updateTitle(me.element, value || 'No title');
        }
    }

    /**
     * Retrieves the parent Panel instance.
     *
     * @returns {import('./Panel.js').Panel | null} The panel instance.
     */
    get panel() {
        return this._panel;
    }

    /**
     * Sets the parent Panel instance.
     *
     * @param {import('./Panel.js').Panel | null} value - The new panel instance.
     * @returns {void}
     */
    set panel(value) {
        if (value !== null && typeof value !== 'object') {
            console.warn(
                `[PanelHeader] Invalid panel assignment (${value}). Must be a Panel instance or null.`
            );
            return;
        }
        this._panel = value;
    }

    /**
     * Retrieves the parent PanelGroup instance.
     *
     * @returns {import('./PanelGroup.js').PanelGroup | null} The parent group.
     */
    get parentGroup() {
        return this._parentGroup;
    }

    /**
     * Sets the parent PanelGroup instance.
     *
     * @param {import('./PanelGroup.js').PanelGroup | null} value - The new parent group.
     * @returns {void}
     */
    set parentGroup(value) {
        if (value !== null && typeof value !== 'object') {
            console.warn(
                `[PanelHeader] Invalid parentGroup assignment (${value}). Must be a PanelGroup instance or null.`
            );
            return;
        }
        this._parentGroup = value;
    }

    /**
     * Implementation of the rendering logic.
     * Uses the adapter to create the tab structure.
     *
     * @returns {HTMLElement} The created tab element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createTabElement(me.id);

        me.renderer.updateTitle(element, me._title);

        // Initialize DragTrigger on the root element
        me._dragTrigger = new DragTrigger(element, {
            threshold: 5,
            onDragStart: (event, startCoords) => me._startDrag(event, startCoords),
            onClick: event => me.onTabClick(event)
        });

        // Attach listeners
        const closeButton = me.renderer.getCloseButton(element);
        if (closeButton) {
            // Stop propagation on pointerdown to prevent DragTrigger interference
            me.renderer.on(closeButton, 'pointerdown', e => e.stopPropagation());
            me.renderer.on(closeButton, 'click', me._boundOnCloseClick);
        }

        me.renderer.on(element, 'contextmenu', me._boundOnContextMenu);

        return element;
    }

    /**
     * Implementation of unmount logic.
     * Cleans up DragTrigger and event listeners.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;

        if (me._dragTrigger) {
            me._dragTrigger.destroy();
            me._dragTrigger = null;
        }

        if (me.element) {
            const closeButton = me.renderer.getCloseButton(me.element);
            if (closeButton) {
                me.renderer.off(closeButton, 'click', me._boundOnCloseClick);
            }
            me.renderer.off(me.element, 'contextmenu', me._boundOnContextMenu);
            me.renderer.unmount(me.element.parentNode, me.element);
        }
    }

    /**
     * Initiates a drag operation via the EventBus.
     *
     * @param {PointerEvent} event - The pointer event.
     * @param {object} startCoords - { startX, startY }.
     * @private
     * @returns {void}
     */
    _startDrag(event, startCoords) {
        const me = this;
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
     * Handles clicks on the tab's close button.
     *
     * @param {MouseEvent} event - The mouse event.
     * @returns {void}
     */
    onCloseClick(event) {
        const me = this;
        event.stopPropagation();

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
     *
     * @param {MouseEvent} event - The mouse event.
     * @returns {void}
     */
    onTabClick(event) {
        event; // Unused but kept for signature consistency
        const me = this;
        if (me.parentGroup && me.panel) {
            me.parentGroup.activePanel = me.panel;
        }
    }

    /**
     * Handles the context menu (right-click) event.
     *
     * @param {MouseEvent} event - The native contextmenu event.
     * @returns {void}
     */
    onContextMenu(event) {
        const me = this;
        event.preventDefault();
        event.stopPropagation();

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
     * Updates the UI based on the Panel's configuration.
     *
     * @param {object} config - The panel configuration object ({ closable, movable }).
     * @returns {void}
     */
    updateConfig(config) {
        const me = this;
        if (!me.element) return;

        if (config.closable !== undefined) {
            me.renderer.updateCloseButtonVisibility(me.element, config.closable);
        }

        if (config.movable !== undefined) {
            me.renderer.setDraggable(me.element, config.movable);
        }
    }

    /**
     * Toggles the visual appearance between 'simple' (header) and 'tab' mode.
     *
     * @param {boolean} isSimpleMode - True if rendering in single-panel mode.
     * @returns {void}
     */
    setMode(isSimpleMode) {
        const me = this;
        if (me.element) {
            me.renderer.setSimpleMode(me.element, isSimpleMode);
        }
    }

    /**
     * Sets the draggable state of the header element.
     * Used by TabStrip to enforce "no-drag" policy in simple mode.
     *
     * @param {boolean} draggable - Whether the header should be draggable.
     * @returns {void}
     */
    setDraggable(draggable) {
        const me = this;
        if (me.element) {
            me.renderer.setDraggable(me.element, draggable);
        }
    }

    /**
     * Wrapper for setTitle (Compatibility).
     *
     * @param {string} title
     * @returns {void}
     */
    setTitle(title) {
        this.title = title;
    }

    /**
     * Wrapper for setParentGroup (Compatibility).
     *
     * @param {import('./PanelGroup.js').PanelGroup} group
     * @returns {void}
     */
    setParentGroup(group) {
        this.parentGroup = group;
    }
}
