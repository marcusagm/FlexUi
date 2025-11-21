import { appBus } from '../../utils/EventBus.js';
import { DragTrigger } from '../../utils/DragTrigger.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { ItemType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * Represents the header/title bar of an ApplicationWindow.
 * This component is responsible for rendering the window title and control buttons
 * (Minimize, Maximize, Close, Pin). It also acts as the primary drag handle for
 * the window using the DragTrigger utility.
 *
 * Properties summary:
 * - element {HTMLElement} : The main DOM element of the header.
 * - _window {ApplicationWindow} : The parent window instance.
 * - _titleElement {HTMLElement} : The element displaying the title text.
 * - _controlsContainer {HTMLElement} : Container for control buttons.
 * - _closeButton {HTMLButtonElement} : Button to close the window.
 * - _maximizeButton {HTMLButtonElement} : Button to maximize/restore the window.
 * - _minimizeButton {HTMLButtonElement} : Button to minimize the window.
 * - _pinButton {HTMLButtonElement} : Button to toggle "always on top".
 * - _dragTrigger {DragTrigger} : Utility to handle drag detection vs clicks.
 * - _boundOnCloseClick {Function} : Bound handler for close click.
 * - _boundOnMaximizeClick {Function} : Bound handler for maximize click.
 * - _boundOnMinimizeClick {Function} : Bound handler for minimize click.
 * - _boundOnPinClick {Function} : Bound handler for pin click.
 *
 * Typical usage:
 * const header = new ApplicationWindowHeader(myWindowInstance, 'My Window Title');
 * parentElement.appendChild(header.element);
 *
 * Events:
 * - Emits (appBus): EventTypes.DND_DRAG_START when dragging starts.
 * - Emits (appBus): EventTypes.WINDOW_CLOSE_REQUEST when close is clicked.
 * - Emits (appBus): EventTypes.WINDOW_FOCUS when clicked.
 *
 * Business rules implemented:
 * - Stops propagation on control buttons to prevent drag initiation.
 * - Emits specific events for window actions (close, maximize, minimize, pin) to be handled by the parent window or service.
 * - Initiates a drag operation specifically typed as APPLICATION_WINDOW.
 * - Handles auto-restore when dragging a maximized window, maintaining relative cursor position.
 *
 * Dependencies:
 * - ../../utils/EventBus.js
 * - ../../utils/DragTrigger.js
 * - ../../constants/EventTypes.js
 * - ../../constants/DNDTypes.js
 *
 * Notes / Additional:
 * - This component is tightly coupled with ApplicationWindow.
 */
export class ApplicationWindowHeader {
    /**
     * The main DOM element of the header.
     *
     * @type {HTMLElement}
     * @public
     */
    element;

    /**
     * The parent window instance.
     *
     * @type {object}
     * @private
     */
    _window;

    /**
     * The element displaying the title text.
     *
     * @type {HTMLElement}
     * @private
     */
    _titleElement;

    /**
     * Container for control buttons.
     *
     * @type {HTMLElement}
     * @private
     */
    _controlsContainer;

    /**
     * Button to close the window.
     *
     * @type {HTMLButtonElement}
     * @private
     */
    _closeButton;

    /**
     * Button to maximize/restore the window.
     *
     * @type {HTMLButtonElement}
     * @private
     */
    _maximizeButton;

    /**
     * Button to minimize the window.
     *
     * @type {HTMLButtonElement}
     * @private
     */
    _minimizeButton;

    /**
     * Button to toggle "always on top".
     *
     * @type {HTMLButtonElement}
     * @private
     */
    _pinButton;

    /**
     * Utility to handle drag detection vs clicks.
     *
     * @type {DragTrigger}
     * @private
     */
    _dragTrigger;

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
     * @param {object} windowInstance - The parent ApplicationWindow instance.
     * @param {string} title - The initial title text.
     */
    constructor(windowInstance, title) {
        const me = this;
        me._window = windowInstance;

        me.element = document.createElement('div');
        me.element.classList.add('window-header');

        me._boundOnCloseClick = me.onCloseClick.bind(me);
        me._boundOnMaximizeClick = me.onMaximizeClick.bind(me);
        me._boundOnMinimizeClick = me.onMinimizeClick.bind(me);
        me._boundOnPinClick = me.onPinClick.bind(me);

        me.build(title);
        me.initEventListeners();

        me._dragTrigger = new DragTrigger(me.element, {
            threshold: 3,
            onDragStart: (event, startCoords) => me._startDrag(event, startCoords),
            onClick: () => me.onHeaderClick()
        });
    }

    /**
     * Builds the DOM structure for the header.
     *
     * @param {string} title - The title to display.
     * @returns {void}
     */
    build(title) {
        const me = this;

        // Title
        me._titleElement = document.createElement('span');
        me._titleElement.classList.add('window-header__title');
        me._titleElement.textContent = title;
        me.element.appendChild(me._titleElement);

        // Controls Container
        me._controlsContainer = document.createElement('div');
        me._controlsContainer.classList.add('window-header__controls');

        // Pin Button
        me._pinButton = me._createButton('pin', '📌', 'Always on Top');
        me._controlsContainer.appendChild(me._pinButton);

        // Minimize Button
        me._minimizeButton = me._createButton('minimize', '−', 'Minimize');
        me._controlsContainer.appendChild(me._minimizeButton);

        // Maximize Button
        me._maximizeButton = me._createButton('maximize', '□', 'Maximize');
        me._controlsContainer.appendChild(me._maximizeButton);

        // Close Button
        me._closeButton = me._createButton('close', '×', 'Close');
        me._closeButton.classList.add('window-header__btn--close');
        me._controlsContainer.appendChild(me._closeButton);

        me.element.appendChild(me._controlsContainer);
    }

    /**
     * Helper to create standardized control buttons.
     *
     * @param {string} action - The action identifier (class suffix).
     * @param {string} label - The visible text/icon.
     * @param {string} ariaLabel - The accessibility label.
     * @returns {HTMLButtonElement} The created button.
     * @private
     */
    _createButton(action, label, ariaLabel) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `window-header__btn window-header__btn--${action}`;
        btn.textContent = label;
        btn.setAttribute('aria-label', ariaLabel);

        // Stop propagation on pointerdown to prevent DragTrigger from capturing this as a drag
        btn.addEventListener('pointerdown', e => e.stopPropagation());

        return btn;
    }

    /**
     * Initializes DOM event listeners for buttons.
     *
     * @returns {void}
     */
    initEventListeners() {
        const me = this;
        me._closeButton.addEventListener('click', me._boundOnCloseClick);
        me._maximizeButton.addEventListener('click', me._boundOnMaximizeClick);
        me._minimizeButton.addEventListener('click', me._boundOnMinimizeClick);
        me._pinButton.addEventListener('click', me._boundOnPinClick);
    }

    /**
     * Cleans up listeners and the DragTrigger instance.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._dragTrigger) {
            me._dragTrigger.destroy();
        }

        me._closeButton.removeEventListener('click', me._boundOnCloseClick);
        me._maximizeButton.removeEventListener('click', me._boundOnMaximizeClick);
        me._minimizeButton.removeEventListener('click', me._boundOnMinimizeClick);
        me._pinButton.removeEventListener('click', me._boundOnPinClick);

        me.element.remove();
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
        appBus.emit(EventTypes.WINDOW_FOCUS, me._window);

        let offsetX = 0;
        let offsetY = 0;

        if (me._window.isMaximized) {
            // Calculate relative position of mouse on the maximized header (0.0 to 1.0)
            const rectMax = me._window.element.getBoundingClientRect();
            const ratioX = (event.clientX - rectMax.left) / rectMax.width;

            // Restore window
            me._window.toggleMaximize();

            // Calculate new X position to keep mouse relative to the restored header
            // We center the window under the mouse based on the previous ratio
            // or essentially update the window's X so the mouse is at the same %

            const rectRestored = me._window.element.getBoundingClientRect();
            const newWindowWidth = rectRestored.width;

            // Calculate correct offset for the ghost
            offsetX = newWindowWidth * ratioX;

            // Update window position immediately so it jumps to the cursor
            const newX = event.clientX - offsetX;

            // We update the window's state (and style via setter)
            me._window.x = newX;
            // Keep Y at top or slightly below mouse, usually just keep offset
            offsetY = event.clientY - rectMax.top; // usually close to 0/header height
            me._window.y = event.clientY - offsetY;
        } else {
            const rect = me._window.element.getBoundingClientRect();
            offsetX = startCoords.startX - rect.left;
            offsetY = startCoords.startY - rect.top;
        }

        appBus.emit(EventTypes.DND_DRAG_START, {
            item: me._window,
            type: ItemType.APPLICATION_WINDOW,
            element: me._window.element,
            event: event,
            offsetX: offsetX,
            offsetY: offsetY
        });
    }

    /**
     * Handles simple clicks on the header (without dragging).
     * Used mainly to bring the window to focus.
     *
     * @returns {void}
     */
    onHeaderClick() {
        const me = this;
        appBus.emit(EventTypes.WINDOW_FOCUS, me._window);
    }

    /**
     * Handles the close button click.
     *
     * @param {MouseEvent} event - The click event.
     * @returns {void}
     */
    onCloseClick(event) {
        event.stopPropagation();
        appBus.emit(EventTypes.WINDOW_CLOSE_REQUEST, this._window);
    }

    /**
     * Handles the maximize button click.
     *
     * @param {MouseEvent} event - The click event.
     * @returns {void}
     */
    onMaximizeClick(event) {
        event.stopPropagation();
        if (this._window && typeof this._window.toggleMaximize === 'function') {
            this._window.toggleMaximize();
        }
    }

    /**
     * Handles the minimize button click.
     *
     * @param {MouseEvent} event - The click event.
     * @returns {void}
     */
    onMinimizeClick(event) {
        event.stopPropagation();
        if (this._window && typeof this._window.minimize === 'function') {
            this._window.minimize();
        }
    }

    /**
     * Handles the pin button click.
     *
     * @param {MouseEvent} event - The click event.
     * @returns {void}
     */
    onPinClick(event) {
        event.stopPropagation();
        if (this._window && typeof this._window.togglePin === 'function') {
            this._window.togglePin();
            this._pinButton.classList.toggle('active');
        }
    }

    /**
     * Updates the title text.
     *
     * @param {string} title - The new title.
     * @returns {void}
     */
    setTitle(title) {
        if (this._titleElement) {
            this._titleElement.textContent = title;
        }
    }
}
