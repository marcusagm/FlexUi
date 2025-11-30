import { UIElement } from '../../core/UIElement.js';
import { VanillaWindowHeaderAdapter } from '../../renderers/vanilla/VanillaWindowHeaderAdapter.js';
import { Event } from '../../utils/Event.js';
import { DragTrigger } from '../../utils/DragTrigger.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { ItemType } from '../../constants/DNDTypes.js';
import { PopoutManagerService } from '../../services/PopoutManagerService.js';

/**
 * Description:
 * Represents the header/title bar of an Window.
 * This class is a controller that inherits from UIElement. It delegates
 * DOM rendering to an adapter and handles user interactions like clicking,
 * dragging (via DragTrigger), and window control actions.
 *
 * Properties summary:
 * - windowInstance {Window} : The parent window instance.
 * - isTabMode {boolean} : Whether the header is in "Tab" (docked) mode.
 *
 * Typical usage:
 * const header = new WindowHeader(myWindowInstance, 'My Title');
 * parentElement.appendChild(header.element);
 *
 * Events:
 * - Emits (Event): EventTypes.DND_DRAG_START
 * - Emits (Event): EventTypes.WINDOW_CLOSE_REQUEST
 * - Emits (Event): EventTypes.WINDOW_FOCUS
 *
 * Business rules implemented:
 * - Inherits from UIElement -> Disposable.
 * - Delegates visual operations to VanillaWindowHeaderAdapter.
 * - Initiates drag operations (supporting both Window and Tab modes).
 * - Handles auto-restore logic when dragging a maximized window.
 * - Manages Popout/Return actions via PopoutManagerService.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaWindowHeaderAdapter.js').VanillaWindowHeaderAdapter}
 * - {import('../../utils/Event.js').Event}
 * - {import('../../utils/DragTrigger.js').DragTrigger}
 * - {import('../../services/PopoutManagerService.js').PopoutManagerService}
 */
export class WindowHeader extends UIElement {
    /**
     * The parent window instance.
     *
     * @type {import('./Window.js').Window}
     * @private
     */
    _windowInstance;

    /**
     * The initial title to render (state is managed by adapter after render).
     *
     * @type {string}
     * @private
     */
    _initialTitle;

    /**
     * Internal flag for current display mode.
     *
     * @type {boolean}
     * @private
     */
    _isTabMode = false;

    /**
     * Utility to handle drag detection vs clicks.
     *
     * @type {DragTrigger | null}
     * @private
     */
    _dragTrigger = null;

    /**
     * Bound handler for close click.
     *
     * @type {Function}
     * @private
     */
    _boundOnCloseClick;

    /**
     * Bound handler for maximize click.
     *
     * @type {Function}
     * @private
     */
    _boundOnMaximizeClick;

    /**
     * Bound handler for minimize click.
     *
     * @type {Function}
     * @private
     */
    _boundOnMinimizeClick;

    /**
     * Bound handler for pin click.
     *
     * @type {Function}
     * @private
     */
    _boundOnPinClick;

    /**
     * Bound handler for popout click.
     *
     * @type {Function}
     * @private
     */
    _boundOnPopoutClick;

    /**
     * Creates an instance of WindowHeader.
     *
     * @param {import('./Window.js').Window} windowInstance - The parent Window instance.
     * @param {string} title - The initial title text.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(windowInstance, title, renderer = null) {
        super(null, renderer || new VanillaWindowHeaderAdapter());
        const me = this;

        me._windowInstance = windowInstance;
        me._initialTitle = title;

        me._boundOnCloseClick = me._onCloseClick.bind(me);
        me._boundOnMaximizeClick = me._onMaximizeClick.bind(me);
        me._boundOnMinimizeClick = me._onMinimizeClick.bind(me);
        me._boundOnPinClick = me._onPinClick.bind(me);
        me._boundOnPopoutClick = me._onPopoutClick.bind(me);

        me.render();
    }

    /**
     * Retrieves the parent window instance.
     *
     * @returns {import('./Window.js').Window} The parent window.
     */
    get windowInstance() {
        return this._windowInstance;
    }

    /**
     * Checks if the header is in Tab Mode.
     *
     * @returns {boolean} True if in tab mode.
     */
    get isTabMode() {
        return this._isTabMode;
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
        me.renderer.buildStructure(element, me._initialTitle);

        me._dragTrigger = new DragTrigger(element, {
            threshold: 3,
            onDragStart: (event, startCoords) => me._startDrag(event, startCoords),
            onClick: () => me._onHeaderClick()
        });

        me._attachListeners(element);

        return element;
    }

    /**
     * Implementation of mount logic.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        super._doMount(container);
    }

    /**
     * Implementation of unmount logic.
     *
     * @protected
     */
    _doUnmount() {
        super._doUnmount();
    }

    /**
     * Attaches listeners to the control buttons via the adapter.
     *
     * @param {HTMLElement} element - The header element.
     * @private
     * @returns {void}
     */
    _attachListeners(element) {
        const me = this;
        if (!element) return;

        const closeBtn = me.renderer.getCloseButton(element);
        const minBtn = me.renderer.getMinimizeButton(element);
        const maxBtn = me.renderer.getMaximizeButton(element);
        const pinBtn = me.renderer.getPinButton(element);
        const popoutBtn = me.renderer.getPopoutButton(element);

        if (closeBtn) me.renderer.on(closeBtn, 'click', me._boundOnCloseClick);
        if (minBtn) me.renderer.on(minBtn, 'click', me._boundOnMinimizeClick);
        if (maxBtn) me.renderer.on(maxBtn, 'click', me._boundOnMaximizeClick);
        if (pinBtn) me.renderer.on(pinBtn, 'click', me._boundOnPinClick);
        if (popoutBtn) me.renderer.on(popoutBtn, 'click', me._boundOnPopoutClick);
    }

    /**
     * Detaches listeners from the control buttons via the adapter.
     *
     * @private
     * @returns {void}
     */
    _detachListeners() {
        const me = this;
        if (!me.element) return;

        const closeBtn = me.renderer.getCloseButton(me.element);
        const minBtn = me.renderer.getMinimizeButton(me.element);
        const maxBtn = me.renderer.getMaximizeButton(me.element);
        const pinBtn = me.renderer.getPinButton(me.element);
        const popoutBtn = me.renderer.getPopoutButton(me.element);

        if (closeBtn) me.renderer.off(closeBtn, 'click', me._boundOnCloseClick);
        if (minBtn) me.renderer.off(minBtn, 'click', me._boundOnMinimizeClick);
        if (maxBtn) me.renderer.off(maxBtn, 'click', me._boundOnMaximizeClick);
        if (pinBtn) me.renderer.off(pinBtn, 'click', me._boundOnPinClick);
        if (popoutBtn) me.renderer.off(popoutBtn, 'click', me._boundOnPopoutClick);
    }

    /**
     * Cleans up resources.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me._dragTrigger) {
            me._dragTrigger.destroy();
            me._dragTrigger = null;
        }
        me._detachListeners();
        super.dispose();
    }

    /**
     * Sets the title text.
     *
     * @param {string} title - The new title.
     * @returns {void}
     */
    setTitle(title) {
        const me = this;
        if (typeof title !== 'string') {
            console.warn(`[WindowHeader] Invalid title assignment (${title}). Must be a string.`);
            return;
        }
        if (me.element) {
            me.renderer.updateTitle(me.element, title);
        } else {
            me._initialTitle = title;
        }
    }

    /**
     * Toggles the header between Window mode and Tab mode.
     *
     * @param {boolean} isTab - True for tab mode, false for window mode.
     * @returns {void}
     */
    setTabMode(isTab) {
        const me = this;
        me._isTabMode = Boolean(isTab);
        if (me.element) {
            me.renderer.setTabMode(me.element, me._isTabMode);
        }
    }

    /**
     * Updates the visual state of the Popout mode.
     * Hides irrelevant controls and changes the popout button icon.
     *
     * @param {boolean} isPopout - True if in popout mode.
     * @returns {void}
     */
    updatePopoutState(isPopout) {
        const me = this;
        if (me.element) {
            me.renderer.setPopoutMode(me.element, Boolean(isPopout));
        }
    }

    /**
     * Updates the visual state of the pin button.
     *
     * @param {boolean} isPinned - True if pinned.
     * @returns {void}
     */
    setPinState(isPinned) {
        const me = this;
        if (me.element) {
            me.renderer.setPinState(me.element, Boolean(isPinned));
        }
    }

    /**
     * Initiates the drag operation via the DragDropService.
     *
     * @param {PointerEvent} event - The original pointer event.
     * @param {object} startCoords - The starting coordinates from DragTrigger.
     * @private
     * @returns {void}
     */
    _startDrag(event, startCoords) {
        const me = this;
        if (!me._windowInstance) return;

        Event.emit(EventTypes.WINDOW_FOCUS, me._windowInstance);

        let offsetX = 0;
        let offsetY = 0;

        if (me._isTabMode) {
            const rect = me.element.getBoundingClientRect();
            offsetX = startCoords.startX - rect.left;
            offsetY = startCoords.startY - rect.top;
        } else if (me._windowInstance.isMaximized) {
            const rectMax = me._windowInstance.element.getBoundingClientRect();
            const ratioX = (event.clientX - rectMax.left) / rectMax.width;

            me._windowInstance.toggleMaximize();

            const rectRestored = me._windowInstance.element.getBoundingClientRect();
            const newWindowWidth = rectRestored.width;

            offsetX = newWindowWidth * ratioX;
            const newX = event.clientX - offsetX;

            me._windowInstance.x = newX;
            offsetY = event.clientY - rectMax.top;
            me._windowInstance.y = event.clientY - offsetY;
        } else {
            const rect = me._windowInstance.element.getBoundingClientRect();
            offsetX = startCoords.startX - rect.left;
            offsetY = startCoords.startY - rect.top;
        }

        const elementToDrag = me._isTabMode ? me.element : me._windowInstance.element;

        Event.emit(EventTypes.DND_DRAG_START, {
            item: me._windowInstance,
            type: ItemType.WINDOW,
            element: elementToDrag,
            event: event,
            offsetX: offsetX,
            offsetY: offsetY,
            isTabDrag: me._isTabMode
        });
    }

    /**
     * Handles simple clicks on the header (without dragging).
     *
     * @private
     * @returns {void}
     */
    _onHeaderClick() {
        const me = this;
        if (me._windowInstance) {
            Event.emit(EventTypes.WINDOW_FOCUS, me._windowInstance);
        }
    }

    /**
     * Handler for close button click.
     *
     * @private
     * @param {MouseEvent} event
     * @returns {void}
     */
    _onCloseClick(event) {
        event.stopPropagation();
        if (this._windowInstance) {
            Event.emit(EventTypes.WINDOW_CLOSE_REQUEST, this._windowInstance);
        }
    }

    /**
     * Handler for maximize button click.
     *
     * @private
     * @param {MouseEvent} event
     * @returns {void}
     */
    _onMaximizeClick(event) {
        event.stopPropagation();
        if (this._windowInstance && typeof this._windowInstance.toggleMaximize === 'function') {
            this._windowInstance.toggleMaximize();
        }
    }

    /**
     * Handler for minimize button click.
     *
     * @private
     * @param {MouseEvent} event
     * @returns {void}
     */
    _onMinimizeClick(event) {
        event.stopPropagation();
        if (this._windowInstance && typeof this._windowInstance.minimize === 'function') {
            this._windowInstance.minimize();
        }
    }

    /**
     * Handler for pin button click.
     *
     * @private
     * @param {MouseEvent} event
     * @returns {void}
     */
    _onPinClick(event) {
        const me = this;
        event.stopPropagation();
        if (me._windowInstance && typeof me._windowInstance.togglePin === 'function') {
            me._windowInstance.togglePin();
            me.setPinState(me._windowInstance.isPinned);
        }
    }

    /**
     * Handler for popout button click.
     *
     * @private
     * @param {MouseEvent} event
     * @returns {void}
     */
    _onPopoutClick(event) {
        const me = this;
        event.stopPropagation();

        if (!me._windowInstance) return;

        const popoutService = PopoutManagerService.getInstance();

        if (me._windowInstance.isPopout) {
            popoutService.returnWindow(me._windowInstance);
        } else {
            popoutService.popoutWindow(me._windowInstance);
        }
    }
}
