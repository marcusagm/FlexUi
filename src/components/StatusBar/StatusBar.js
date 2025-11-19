import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Manages the global application status bar, displayed at the bottom of the UI.
 * It listens to appBus events to display permanent or temporary messages.
 *
 * Properties summary:
 * - element {HTMLElement}: The main DOM element (<div class="status-bar">).
 * - _namespace {string} : Unique namespace for appBus listeners.
 * - _permanentMessageElement {HTMLElement} : The element for the permanent message.
 * - _tempMessageElement {HTMLElement} : The element for the temporary message.
 * - _messageTimer {number|null} : Stores the setTimeout ID for clearing temporary messages.
 * - _boundSetMessage {Function|null} : Bound handler for setting a temporary message.
 * - _boundSetPermanentMessage {Function|null} : Bound handler for setting a permanent message.
 * - _boundClearMessage {Function|null} : Bound handler for clearing the temporary message.
 *
 * Typical usage:
 * // In App.js
 * const statusBar = new StatusBar();
 * document.body.appendChild(statusBar.element);
 *
 * Events:
 * - Listens to (appBus): EventTypes.STATUSBAR_SET_STATUS, EventTypes.STATUSBAR_SET_PERMANENT_STATUS, EventTypes.STATUSBAR_CLEAR_STATUS
 *
 * Dependencies:
 * - ../../utils/EventBus.js
 * - ../../constants/EventTypes.js
 */
export class StatusBar {
    /**
     * The main <div> element for the status bar.
     * @type {HTMLElement}
     * @public
     */
    element;

    /**
     * Unique namespace for appBus listeners.
     * @type {string}
     * @private
     */
    _namespace = 'app-statusbar';

    /**
     * The <span> element that holds the permanent (left-aligned) message.
     * @type {HTMLElement}
     * @private
     */
    _permanentMessageElement;

    /**
     * The <span> element that holds the temporary (right-aligned) message.
     * @type {HTMLElement}
     * @private
     */
    _tempMessageElement;

    /**
     * Stores the setTimeout ID for clearing temporary messages.
     * @type {number|null}
     * @private
     */
    _messageTimer = null;

    /**
     * Bound handler for setting a temporary message.
     * @type {Function | null}
     * @private
     */
    _boundSetMessage = null;

    /**
     * Bound handler for setting a permanent message.
     * @type {Function | null}
     * @private
     */
    _boundSetPermanentMessage = null;

    /**
     * Bound handler for clearing the temporary message.
     * @type {Function | null}
     * @private
     */
    _boundClearMessage = null;

    /**
     * @param {string} [defaultStatus='Pronto'] - The default permanent message.
     */
    constructor(defaultStatus = 'Pronto') {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('status-bar');

        me._permanentMessageElement = document.createElement('span');
        me._permanentMessageElement.classList.add('status-bar__permanent');

        me._tempMessageElement = document.createElement('span');
        me._tempMessageElement.classList.add('status-bar__temporary');

        me.element.append(me._permanentMessageElement, me._tempMessageElement);

        // Store bound handlers
        me._boundSetMessage = me.setMessage.bind(me);
        me._boundSetPermanentMessage = me.setPermanentMessage.bind(me);
        me._boundClearMessage = me.clearMessage.bind(me);

        me._initEventListeners();
        me.setPermanentMessage(defaultStatus);
    }

    /**
     * Initializes the appBus event listeners.
     * @private
     * @returns {void}
     */
    _initEventListeners() {
        const me = this;
        const options = { namespace: me._namespace };

        appBus.on(EventTypes.STATUSBAR_SET_STATUS, me._boundSetMessage, options);
        appBus.on(EventTypes.STATUSBAR_SET_PERMANENT_STATUS, me._boundSetPermanentMessage, options);
        appBus.on(EventTypes.STATUSBAR_CLEAR_STATUS, me._boundClearMessage, options);
    }

    /**
     * Cleans up appBus listeners and clears any pending timers.
     * @returns {void}
     */
    destroy() {
        const me = this;
        appBus.offByNamespace(me._namespace);

        if (me._messageTimer) {
            clearTimeout(me._messageTimer);
            me._messageTimer = null;
        }

        me.element.remove();
    }

    /**
     * Displays a temporary message that clears after a duration.
     * @param {string} message - The text to display.
     * @param {number} [duration=3000] - Time in ms before clearing.
     * @returns {void}
     */
    setMessage(message, duration = 3000) {
        const me = this;

        me._tempMessageElement.textContent = message;

        if (me._messageTimer) {
            clearTimeout(me._messageTimer);
        }

        me._messageTimer = setTimeout(() => {
            me.clearMessage();
        }, duration);
    }

    /**
     * Displays a permanent message (e.g., "Pronto").
     * @param {string} message - The text to display.
     * @returns {void}
     */
    setPermanentMessage(message) {
        this._permanentMessageElement.textContent = message;
    }

    /**
     * Clears the temporary status message immediately.
     * @returns {void}
     */
    clearMessage() {
        const me = this;
        me._tempMessageElement.textContent = '';
        if (me._messageTimer) {
            clearTimeout(me._messageTimer);
            me._messageTimer = null;
        }
    }
}
