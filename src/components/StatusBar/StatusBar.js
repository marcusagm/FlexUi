import { UIElement } from '../../core/UIElement.js';
import { VanillaStatusBarAdapter } from '../../renderers/vanilla/VanillaStatusBarAdapter.js';
import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * A component that displays status information at the bottom of the application.
 * It supports two types of messages:
 * 1. Permanent: Always visible (e.g., "Ready").
 * 2. Temporary: Visible for a short duration (e.g., "Saved successfully"), overlaying or sitting beside the permanent message.
 *
 * It acts as a controller inheriting from UIElement and delegates DOM operations to VanillaStatusBarAdapter.
 *
 * Properties summary:
 * - _messageTimer {number|null} : The ID of the active timeout for clearing temporary messages.
 * - _boundSetMessage {Function} : Bound handler for setting temporary messages.
 * - _boundSetPermanent {Function} : Bound handler for setting permanent messages.
 * - _defaultStatus {string} : The initial status text.
 *
 * Typical usage:
 * const statusBar = new StatusBar('Ready');
 * statusBar.mount(document.body);
 *
 * Events:
 * - Listens to: EventTypes.STATUSBAR_SET_STATUS
 * - Listens to: EventTypes.STATUSBAR_SET_PERMANENT_STATUS
 *
 * Business rules implemented:
 * - Temporary messages automatically clear after a specified duration.
 * - Setting a new temporary message clears any pending timeout.
 * - Permanent messages persist until explicitly changed.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaStatusBarAdapter.js').VanillaStatusBarAdapter}
 * - {import('../../utils/EventBus.js').appBus}
 */
export class StatusBar extends UIElement {
    /**
     * The ID of the active timeout for clearing temporary messages.
     *
     * @type {number|null}
     * @private
     */
    _messageTimer = null;

    /**
     * Bound handler for setting temporary messages via appBus.
     *
     * @type {Function}
     * @private
     */
    _boundSetMessage;

    /**
     * Bound handler for setting permanent messages via appBus.
     *
     * @type {Function}
     * @private
     */
    _boundSetPermanent;

    /**
     * The initial status text.
     *
     * @type {string}
     * @private
     */
    _defaultStatus = 'Pronto';

    /**
     * Creates a new StatusBar instance.
     *
     * @param {string} [defaultStatus='Pronto'] - The initial permanent message.
     * @param {object} [config={}] - Configuration object (reserved for future use).
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(defaultStatus = 'Pronto', config = {}, renderer = null) {
        super(null, renderer || new VanillaStatusBarAdapter());
        const me = this;

        me._defaultStatus = defaultStatus;

        me._boundSetMessage = (msg, duration) => me.setMessage(msg, duration);
        me._boundSetPermanent = msg => me.setPermanentMessage(msg);

        me.render();
    }

    /**
     * Implementation of the rendering logic.
     * Creates the DOM structure and sets the initial permanent message.
     *
     * @returns {HTMLElement} The root status bar element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createStatusBarElement(me.id);
        me.renderer.updatePermanentMessage(element, me._defaultStatus);
        return element;
    }

    /**
     * Implementation of the mounting logic.
     * Subscribes to appBus events.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me.element) {
            if (me.element.parentNode !== container) {
                me.renderer.mount(container, me.element);
            }
        }

        appBus.on(EventTypes.STATUSBAR_SET_STATUS, me._boundSetMessage);
        appBus.on(EventTypes.STATUSBAR_SET_PERMANENT_STATUS, me._boundSetPermanent);
    }

    /**
     * Implementation of the unmounting logic.
     * Unsubscribes from appBus events and clears timers.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;

        appBus.off(EventTypes.STATUSBAR_SET_STATUS, me._boundSetMessage);
        appBus.off(EventTypes.STATUSBAR_SET_PERMANENT_STATUS, me._boundSetPermanent);

        if (me._messageTimer) {
            clearTimeout(me._messageTimer);
            me._messageTimer = null;
        }

        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
    }

    /**
     * Sets a temporary message on the status bar.
     *
     * @param {string} message - The message text.
     * @param {number} [duration=3000] - Duration in ms before clearing.
     * @returns {void}
     */
    setMessage(message, duration = 3000) {
        const me = this;
        if (!me.element) return;

        if (me._messageTimer) {
            clearTimeout(me._messageTimer);
            me._messageTimer = null;
        }

        me.renderer.updateTemporaryMessage(me.element, message);

        if (duration > 0) {
            me._messageTimer = setTimeout(() => {
                me.clearMessage();
            }, duration);
        }
    }

    /**
     * Sets the permanent message (default status).
     *
     * @param {string} message - The permanent status text.
     * @returns {void}
     */
    setPermanentMessage(message) {
        const me = this;
        if (!me.element) return;

        me.renderer.updatePermanentMessage(me.element, message);
    }

    /**
     * Clears the temporary message.
     *
     * @returns {void}
     */
    clearMessage() {
        const me = this;
        if (!me.element) return;

        me.renderer.updateTemporaryMessage(me.element, '');
        me._messageTimer = null;
    }
}
