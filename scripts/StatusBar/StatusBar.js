import { appBus } from '../EventBus.js';

/**
 * Description:
 * Manages the global application status bar, displayed at the bottom of the UI.
 * It listens to appBus events to display permanent or temporary messages.
 *
 * Properties summary:
 * - element {HTMLElement}: The main DOM element (<div class="status-bar">).
 * - _permanentMessageElement {HTMLElement}: The <span> holding the fixed message.
 * - _tempMessageElement {HTMLElement}: The <span> holding the temporary message.
 * - _messageTimer {number|null}: The timeout ID for temporary messages.
 *
 * Typical usage:
 * // In App.js
 * const statusBar = new StatusBar();
 * document.body.appendChild(statusBar.element);
 *
 * // To show a temporary message (e.g., "Resetado")
 * appBus.emit('app:set-status-message', 'Workspace resetado.');
 *
 * // To set the permanent message (e.g., "Pronto")
 * appBus.emit('app:set-permanent-status', 'Pronto');
 */
export class StatusBar {
    /**
     * The main <div> element for the status bar.
     * @type {HTMLElement}
     */
    element;

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

        me._initEventListeners();
        me.setPermanentMessage(defaultStatus);
    }

    /**
     * Initializes the appBus event listeners.
     * @private
     */
    _initEventListeners() {
        const me = this;
        // Evento para mensagens temporárias (ex: "Salvo!")
        appBus.on('app:set-status-message', me.setMessage.bind(me));
        // Evento para mensagens fixas (ex: "Pronto")
        appBus.on('app:set-permanent-status', me.setPermanentMessage.bind(me));
        // Evento para limpar a mensagem (raro, mas útil)
        appBus.on('app:clear-status', me.clearMessage.bind(me));
    }

    /**
     * Displays a temporary message that clears after a duration.
     * @param {string} message - The text to display.
     * @param {number} [duration=3000] - Time in ms before clearing.
     */
    setMessage(message, duration = 3000) {
        const me = this;

        // Define o texto
        me._tempMessageElement.textContent = message;

        // Limpa qualquer timer existente para reiniciar a contagem
        if (me._messageTimer) {
            clearTimeout(me._messageTimer);
        }

        // Define um novo timer para limpar a mensagem
        me._messageTimer = setTimeout(() => {
            me.clearMessage();
        }, duration);
    }

    /**
     * Displays a permanent message (e.g., "Pronto").
     * @param {string} message - The text to display.
     */
    setPermanentMessage(message) {
        this._permanentMessageElement.textContent = message;
    }

    /**
     * Clears the temporary status message immediately.
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
