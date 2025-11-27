import { UIElement } from '../../core/UIElement.js';
import { VanillaWindowHeaderAdapter } from '../../renderers/vanilla/VanillaWindowHeaderAdapter.js';
import { appBus } from '../../utils/EventBus.js';
import { DragTrigger } from '../../utils/DragTrigger.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * Represents the header/title bar of an ApplicationWindow.
 * This class is a controller that inherits from UIElement. It delegates
 * DOM rendering to an adapter and handles user interactions like clicking,
 * dragging (via DragTrigger), and window control actions.
 *
 * Properties summary:
 * - windowInstance {ApplicationWindow} : The parent window instance.
 * - isTabMode {boolean} : Whether the header is in "Tab" (docked) mode.
 *
 * Typical usage:
 * const header = new ApplicationWindowHeader(myWindowInstance, 'My Title');
 * parentElement.appendChild(header.element);
 *
 * Events:
 * - Emits (appBus): EventTypes.DND_DRAG_START
 * - Emits (appBus): EventTypes.WINDOW_CLOSE_REQUEST
 * - Emits (appBus): EventTypes.WINDOW_FOCUS
 *
 * Business rules implemented:
 * - Inherits from UIElement -> Disposable.
 * - Delegates visual operations to VanillaWindowHeaderAdapter.
 * - Initiates drag operations (supporting both Window and Tab modes).
 * - Handles auto-restore logic when dragging a maximized window.
 * - Validates inputs via setters.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaWindowHeaderAdapter.js').VanillaWindowHeaderAdapter}
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../utils/DragTrigger.js').DragTrigger}
 */
export class ApplicationWindowHeader extends UIElement {
    /**
     * The parent window instance.
     *
     * @type {import('./ApplicationWindow.js').ApplicationWindow}
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
     * Creates an instance of ApplicationWindowHeader.
     *
     * @param {import('./ApplicationWindow.js').ApplicationWindow} windowInstance - The parent ApplicationWindow instance.
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

        // Initialize DOM via UIElement lifecycle
        me.render();
    }

    /**
     * Retrieves the parent window instance.
     *
     * @returns {import('./ApplicationWindow.js').ApplicationWindow} The parent window.
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
        // Logic moved to _doRender to support TabStrip usage without explicit mount
    }

    /**
     * Implementation of unmount logic.
     *
     * @protected
     */
    _doUnmount() {
        // Logic moved to dispose/cleanup methods as unmount is unreliable in TabStrip context
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

        if (closeBtn) me.renderer.on(closeBtn, 'click', me._boundOnCloseClick);
        if (minBtn) me.renderer.on(minBtn, 'click', me._boundOnMinimizeClick);
        if (maxBtn) me.renderer.on(maxBtn, 'click', me._boundOnMaximizeClick);
        if (pinBtn) me.renderer.on(pinBtn, 'click', me._boundOnPinClick);
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

        if (closeBtn) me.renderer.off(closeBtn, 'click', me._boundOnCloseClick);
        if (minBtn) me.renderer.off(minBtn, 'click', me._boundOnMinimizeClick);
        if (maxBtn) me.renderer.off(maxBtn, 'click', me._boundOnMaximizeClick);
        if (pinBtn) me.renderer.off(pinBtn, 'click', me._boundOnPinClick);
    }

    /**
     * Cleans up resources.
     * Overrides Disposable.dispose to ensure listeners and DragTrigger are removed,
     * as unmount() might not have been called if managed by TabStrip.
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
            console.warn(
                `[ApplicationWindowHeader] Invalid title assignment (${title}). Must be a string.`
            );
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
     * In Tab mode, irrelevant controls (Pin, Min, Max) are hidden.
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
     * Handles auto-restore if the window is maximized.
     *
     * @param {PointerEvent} event - The original pointer event.
     * @param {object} startCoords - The starting coordinates from DragTrigger.
     * @private
     * @returns {void}
     */
    _startDrag(event, startCoords) {
        const me = this;
        if (!me._windowInstance) return;

        appBus.emit(EventTypes.WINDOW_FOCUS, me._windowInstance);

        let offsetX = 0;
        let offsetY = 0;

        // If in Tab Mode, dragging the header represents undocking or reordering.
        if (me._isTabMode) {
            const rect = me.element.getBoundingClientRect();
            offsetX = startCoords.startX - rect.left;
            offsetY = startCoords.startY - rect.top;
        } else if (me._windowInstance.isMaximized) {
            // Calculate relative position of mouse on the maximized header (0.0 to 1.0)
            const rectMax = me._windowInstance.element.getBoundingClientRect();
            const ratioX = (event.clientX - rectMax.left) / rectMax.width;

            // Restore window (will trigger resize and state updates)
            me._windowInstance.toggleMaximize();

            // Calculate new X position to keep mouse relative to the restored header
            const rectRestored = me._windowInstance.element.getBoundingClientRect();
            const newWindowWidth = rectRestored.width;

            offsetX = newWindowWidth * ratioX;
            const newX = event.clientX - offsetX;

            // Update window coordinates
            me._windowInstance.x = newX;
            offsetY = event.clientY - rectMax.top;
            me._windowInstance.y = event.clientY - offsetY;
        } else {
            // Standard drag
            const rect = me._windowInstance.element.getBoundingClientRect();
            offsetX = startCoords.startX - rect.left;
            offsetY = startCoords.startY - rect.top;
        }

        // In Tab Mode, we drag the header element itself (the tab).
        // In Window Mode, we drag the whole window element.
        const elementToDrag = me._isTabMode ? me.element : me._windowInstance.element;

        appBus.emit(EventTypes.DND_DRAG_START, {
            item: me._windowInstance,
            type: ItemType.APPLICATION_WINDOW,
            element: elementToDrag,
            event: event,
            offsetX: offsetX,
            offsetY: offsetY,
            isTabDrag: me._isTabMode
        });
    }

    /**
     * Handles simple clicks on the header (without dragging).
     * Used mainly to bring the window to focus.
     *
     * @private
     * @returns {void}
     */
    _onHeaderClick() {
        const me = this;
        if (me._windowInstance) {
            appBus.emit(EventTypes.WINDOW_FOCUS, me._windowInstance);
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
            appBus.emit(EventTypes.WINDOW_CLOSE_REQUEST, this._windowInstance);
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
            // Update visual state
            me.setPinState(me._windowInstance.isPinned);
        }
    }
}
