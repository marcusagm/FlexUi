import { TranslationService } from '../TranslationService.js';
import { Event } from '../../utils/Event.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * Handles the rendering and DOM manipulation of notifications.
 * This class listens to notification events dispatched on the internal EventBus (Event)
 * and translates them into visible HTML elements. It uses TranslationService for button
 * localization and assumes a BEM-style CSS structure for styling.
 *
 * Properties summary:
 * - _targetElement {HTMLElement} : The main DOM element where notification containers will be appended.
 * - _containerMap {Map<string, HTMLElement>} : Stores references to notification containers by position.
 * - _notificationService {NotificationService} : A reference to the service instance, used for dismiss actions.
 * - _iconMap {object} : A mapping of notification types to their corresponding CSS icon classes.
 *
 * Typical usage:
 * // In main.js
 * const uiListener = new NotificationUIListener(document.body);
 * uiListener.listen(appNotifications);
 *
 * Events:
 * - Listens to (Event): EventTypes.NOTIFICATION_SHOW, EventTypes.NOTIFICATION_DISMISS
 *
 * Dependencies:
 * - ../TranslationService.js
 * - ../../utils/Event.js
 * - ../../constants/EventTypes.js
 */
export class NotificationUIListener {
    /**
     * The main DOM element where notification containers will be appended.
     *
     * @private
     * @type {HTMLElement}
     */
    _targetElement;

    /**
     * Stores references to notification containers (e.g., '.notification-container--top-right').
     *
     * @private
     * @type {Map<string, HTMLElement>}
     */
    _containerMap;

    /**
     * A reference to the NotificationService, required to call dismiss() from buttons.
     *
     * @private
     * @type {object|null}
     */
    _notificationService;

    /**
     * Maps notification types to their CSS icon classes.
     *
     * @private
     * @type {object}
     */
    _iconMap;

    /**
     * Initializes the listener.
     *
     * @param {HTMLElement} [targetElement=document.body] - The element to which notification containers will be attached.
     */
    constructor(targetElement = document.body) {
        const me = this;
        if (!targetElement || typeof targetElement.appendChild !== 'function') {
            console.error(
                'NotificationUIListener: Invalid targetElement provided. Defaulting to document.body.'
            );
            me._targetElement = document.body;
        } else {
            me._targetElement = targetElement;
        }

        me._containerMap = new Map();
        me._notificationService = null;

        // Use the setter to initialize
        me.iconMap = {
            info: 'icon-info-circle',
            success: 'icon-check-circle',
            warning: 'icon-warning-triangle',
            danger: 'icon-error-circle'
        };
    }

    /**
     * Gets the icon map object.
     *
     * @returns {object} The current icon map.
     */
    get iconMap() {
        return this._iconMap;
    }

    /**
     * Sets and merges the icon map object.
     *
     * @param {object} newMap - An object mapping notification types to CSS icon classes.
     * @returns {void}
     */
    set iconMap(newMap) {
        if (typeof newMap !== 'object' || newMap === null || Array.isArray(newMap)) {
            console.warn('NotificationUIListener.iconMap: Input must be a valid object.');
            return;
        }
        this._iconMap = { ...this._iconMap, ...newMap };
    }

    /**
     * Starts listening for notification events on the document.
     *
     * @param {object} notificationServiceInstance - The instance of NotificationService.
     * This is needed to allow default buttons to call the dismiss() method.
     * @returns {void}
     */
    listen(notificationServiceInstance) {
        const me = this;
        if (
            !notificationServiceInstance ||
            typeof notificationServiceInstance.dismiss !== 'function'
        ) {
            console.error(
                'NotificationUIListener.listen: A valid NotificationService instance must be provided.'
            );
            return;
        }
        me._notificationService = notificationServiceInstance;

        // Listen to Event events using constants
        Event.on(EventTypes.NOTIFICATION_SHOW, me._handleShow.bind(me));
        Event.on(EventTypes.NOTIFICATION_DISMISS, me._handleDismiss.bind(me));
    }

    /**
     * Handles the 'show-notification' event from 'Event'.
     *
     * @param {object} options - The event payload (options object).
     * @private
     * @returns {void}
     */
    _handleShow(options) {
        const me = this;

        // 1. Get or create the container for this position
        const container = me._getContainer(options.position);

        // 2. Create the main notification element
        const notificationElement = document.createElement('div');
        notificationElement.className = me._buildClassList(options);
        notificationElement.setAttribute('data-id', options.id);
        notificationElement.setAttribute('role', 'alert');
        notificationElement.setAttribute('aria-live', 'assertive');

        // 3. Create and append the icon (if applicable)
        const iconElement = me._createIconElement(options);
        if (iconElement) {
            notificationElement.appendChild(iconElement);
        }

        // 4. Create the content wrapper
        const contentElement = document.createElement('div');
        contentElement.className = 'notification__content';

        // 5. Create and append the message
        const messageElement = document.createElement('p');
        messageElement.className = 'notification__message';
        messageElement.textContent = options.message; // Assuming message is plain text
        contentElement.appendChild(messageElement);

        // 6. Create and append buttons (default + custom)
        const buttonsElement = me._createButtonsElement(options);
        if (buttonsElement) {
            contentElement.appendChild(buttonsElement);
        }
        notificationElement.appendChild(contentElement);

        // 7. Create a 'close' button for sticky notifications
        if (options.sticky) {
            notificationElement.appendChild(me._createCloseButton(options.id));
        }

        // 8. Append to DOM
        if (options.position.startsWith('bottom')) {
            container.prepend(notificationElement);
        } else {
            container.appendChild(notificationElement);
        }

        // 9. Trigger entry animation
        requestAnimationFrame(() => {
            notificationElement.classList.add('is-entering');
        });

        // 10. Set auto-dismiss timer
        if (options.sticky !== true && options.duration > 0) {
            setTimeout(() => {
                me._notificationService.dismiss(options.id);
            }, options.duration);
        }
    }

    /**
     * Handles the 'dismiss-notification' event from 'Event'.
     *
     * @param {object} payload - The event payload ({ id: string }).
     * @private
     * @returns {void}
     */
    _handleDismiss(payload) {
        const me = this;
        const { id } = payload;
        const element = document.querySelector(`.notification[data-id="${id}"]`);

        if (!element) {
            return; // Already dismissed
        }

        // Trigger exit animation
        element.classList.remove('is-entering');
        element.classList.add('is-exiting');

        // Ouve 'transitionend' para remover o elemento após a animação de saída.
        element.addEventListener(
            'transitionend',
            () => {
                element.remove();
                // Check if the container is now empty and remove it
                me._cleanupEmptyContainers();
            },
            { once: true }
        );
    }

    /**
     * Gets or creates the DOM container for a specific notification position.
     *
     * @param {string} position - e.g., 'top-right', 'bottom-center'.
     * @returns {HTMLElement} The container element.
     * @private
     */
    _getContainer(position) {
        const me = this;
        if (me._containerMap.has(position)) {
            return me._containerMap.get(position);
        }

        // Create new container
        const container = document.createElement('div');
        container.className = `notification-container notification-container--${position}`;
        me._targetElement.appendChild(container);
        me._containerMap.set(position, container);
        return container;
    }

    /**
     * Builds the CSS class list for the main notification element.
     *
     * @param {object} options - The notification options.
     * @returns {string} The complete class string.
     * @private
     */
    _buildClassList(options) {
        const classes = [
            'notification',
            `notification--${options.variant}`,
            `notification--${options.type}`
        ];

        if (options.sticky) {
            classes.push('notification--sticky');
        }

        return classes.join(' ');
    }

    /**
     * Creates the icon element based on notification type.
     *
     * @param {object} options - The notification options.
     * @returns {HTMLElement|null} The icon element or null.
     * @private
     */
    _createIconElement(options) {
        const me = this;
        const iconClass = me._iconMap[options.type];

        if (!iconClass) {
            return null;
        }

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'notification__icon-wrapper';

        const iconElement = document.createElement('span');
        iconElement.className = `icon ${iconClass}`;
        iconWrapper.appendChild(iconElement);

        return iconWrapper;
    }

    /**
     * Creates the close (X) button for sticky notifications.
     *
     * @param {string} id - The ID of the notification to dismiss.
     * @returns {HTMLElement} The close button element.
     * @private
     */
    _createCloseButton(id) {
        const me = this;
        const closeButton = document.createElement('button');
        closeButton.className = 'notification__close-button';
        closeButton.innerHTML = '&times;';
        const i18n = TranslationService.getInstance();
        closeButton.setAttribute('aria-label', i18n.translate('actions.close'));

        closeButton.onclick = () => {
            me._notificationService.dismiss(id);
        };

        return closeButton;
    }

    /**
     * Creates the button container, including default (OK/Cancel) and custom buttons.
     *
     * @param {object} options - The notification options.
     * @returns {HTMLElement|null} The buttons container element or null if no buttons.
     * @private
     */
    _createButtonsElement(options) {
        const me = this;
        const customButtons = options.buttons || [];
        const standardButtons = [];
        const i18n = TranslationService.getInstance();

        if (options.showCancelButton) {
            standardButtons.push({
                text: i18n.translate('actions.cancel'),
                cssClass: 'notification__button--cancel',
                onClick: id => me._notificationService.dismiss(id)
            });
        }

        if (options.showOKButton) {
            standardButtons.push({
                text: i18n.translate('actions.ok'),
                cssClass: 'notification__button--ok',
                onClick: id => me._notificationService.dismiss(id)
            });
        }

        const allButtons = [...standardButtons, ...customButtons];

        if (allButtons.length === 0) {
            return null;
        }

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'notification__buttons';

        allButtons.forEach(buttonOptions => {
            const buttonElement = document.createElement('button');
            buttonElement.className = 'notification__button';

            if (buttonOptions.cssClass) {
                buttonElement.classList.add(buttonOptions.cssClass);
            }

            buttonElement.textContent = buttonOptions.text;
            buttonElement.onclick = buttonOptions.onClick;

            buttonsContainer.appendChild(buttonElement);
        });

        return buttonsContainer;
    }

    /**
     * Removes any notification containers that are empty.
     *
     * @private
     * @returns {void}
     */
    _cleanupEmptyContainers() {
        const me = this;
        me._containerMap.forEach((container, position) => {
            if (container.childElementCount === 0) {
                container.remove();
                me._containerMap.delete(position);
            }
        });
    }
}
