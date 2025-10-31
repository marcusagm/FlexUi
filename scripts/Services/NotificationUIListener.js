import { TranslationService } from './TranslationService.js';

/**
 * Description:
 * Handles the rendering and DOM manipulation of notifications.
 * This class listens to 'show-notification' and 'dismiss-notification' events
 * dispatched on the document (e.g., by NotificationService) and translates
 * them into visible HTML elements. It uses TranslationService for button
 * localization and assumes a BEM-style CSS structure for styling.
 *
 * Properties summary:
 * - _targetElement {HTMLElement} : The main DOM element where notification containers will be appended.
 * - _containerMap {Map<string, HTMLElement>} : Stores references to notification containers by position.
 * - _notificationService {NotificationService} : A reference to the service instance, used for dismiss actions.
 * - _iconMap {object} : A mapping of notification types to their corresponding CSS icon classes.
 *
 * Typical usage:
 * // In your main application file (e.g., main.js)
 * import { NotificationService } from './NotificationService.js';
 * import { NotificationUIListener } from './NotificationUIListener.js';
 *
 * // 1. Create the service
 * const appNotifications = new NotificationService({
 * position: 'top-right',
 * duration: 5000
 * });
 *
 * // 2. Create and start the listener
 * const uiListener = new NotificationUIListener(document.body);
 * uiListener.listen(appNotifications);
 *
 * // 3. Now, any call to appNotifications will automatically render UI
 * appNotifications.success('User saved!');
 *
 * // 4. Example with default buttons
 * appNotifications.show({
 * message: 'Are you sure you want to delete this?',
 * type: 'warning',
 * variant: 'snackbar',
 * sticky: true,
 * showOKButton: true,
 * showCancelButton: true,
 * buttons: [ // You can still add custom buttons
 * { text: 'Custom', onClick: () => console.log('Custom action') }
 * ]
 * });
 *
 * Notes / Additional:
 * - This class relies on CSS classes defined in your global stylesheet (e.g., all.css)
 * for all styling, icons, and animations (e.g., .notification, .notification--warning, .is-entering).
 */
export class NotificationUIListener {
    /**
     * The main DOM element where notification containers will be appended.
     * @private
     * @type {HTMLElement}
     */
    _targetElement;

    /**
     * Stores references to notification containers (e.g., '.notification-container--top-right').
     * @private
     * @type {Map<string, HTMLElement>}
     */
    _containerMap;

    /**
     * A reference to the NotificationService, required to call dismiss() from buttons.
     * @private
     * @type {object|null}
     */
    _notificationService;

    /**
     * Maps notification types to their CSS icon classes.
     * @private
     * @type {object}
     */
    _iconMap;

    /**
     * Initializes the listener.
     * @param {HTMLElement} [targetElement=document.body] - The element to which notification containers will be attached.
     */
    constructor(targetElement = document.body) {
        if (!targetElement || typeof targetElement.appendChild !== 'function') {
            console.error(
                'NotificationUIListener: Invalid targetElement provided. Defaulting to document.body.'
            );
            this._targetElement = document.body;
        } else {
            this._targetElement = targetElement;
        }

        this._containerMap = new Map();
        this._notificationService = null;

        // Use the setter to initialize
        this.iconMap = {
            info: 'icon-info-circle', // Assumed CSS class
            success: 'icon-check-circle', // Assumed CSS class
            warning: 'icon-warning-triangle', // Assumed CSS class
            danger: 'icon-error-circle' // Assumed CSS class
        };
    }

    /**
     * Gets the icon map object.
     * @returns {object} The current icon map.
     */
    get iconMap() {
        return this._iconMap;
    }

    /**
     * Sets and merges the icon map object.
     * @param {object} newMap - An object mapping notification types to CSS icon classes.
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
     * @param {object} notificationServiceInstance - The instance of NotificationService.
     * This is needed to allow default buttons to call the dismiss() method.
     */
    listen(notificationServiceInstance) {
        if (
            !notificationServiceInstance ||
            typeof notificationServiceInstance.dismiss !== 'function'
        ) {
            console.error(
                'NotificationUIListener.listen: A valid NotificationService instance must be provided.'
            );
            return;
        }
        this._notificationService = notificationServiceInstance;

        // Bind 'this' context for event handlers
        document.addEventListener('show-notification', this._handleShow.bind(this));
        document.addEventListener('dismiss-notification', this._handleDismiss.bind(this));
    }

    /**
     * Handles the 'show-notification' event by creating and rendering the notification element.
     * @param {CustomEvent} event - The event dispatched by NotificationService.
     * @private
     */
    _handleShow(event) {
        const me = this;
        const options = event.detail;

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
        // For bottom positions, new notifications should appear on top of old ones
        if (options.position.startsWith('bottom')) {
            container.prepend(notificationElement);
        } else {
            container.appendChild(notificationElement);
        }

        // 9. Trigger entry animation (CSS handles this)
        // We use requestAnimationFrame to ensure the 'is-entering' class
        // is added after the element is in the DOM, triggering the transition.
        requestAnimationFrame(() => {
            notificationElement.classList.add('is-entering');
        });

        // 10. Set auto-dismiss timer
        if (options.sticky !== true && options.duration > 0) {
            setTimeout(() => {
                // We call the *service* to dismiss, not the listener.
                // This keeps the service as the single source of truth.
                me._notificationService.dismiss(options.id);
            }, options.duration);
        }
    }

    /**
     * Handles the 'dismiss-notification' event by finding and removing the element.
     * @param {CustomEvent} event - The event dispatched by NotificationService.
     * @private
     */
    _handleDismiss(event) {
        const me = this;
        const { id } = event.detail;
        const element = document.querySelector(`.notification[data-id="${id}"]`);

        if (!element) {
            return; // Already dismissed
        }

        // Trigger exit animation
        element.classList.remove('is-entering');
        element.classList.add('is-exiting');

        // Remove from DOM after animation completes
        element.addEventListener('animationend', () => {
            element.remove();
            // Check if the container is now empty and remove it
            me._cleanupEmptyContainers();
        });
    }

    /**
     * Gets or creates the DOM container for a specific notification position.
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
     * @param {object} options - The notification options.
     * @returns {string} The complete class string.
     * @private
     */
    _buildClassList(options) {
        const classes = [
            'notification',
            `notification--${options.variant}`, // .notification--toast, .notification--snackbar
            `notification--${options.type}` // .notification--info, .notification--warning
        ];

        if (options.sticky) {
            classes.push('notification--sticky');
        }

        return classes.join(' ');
    }

    /**
     * Creates the icon element based on notification type.
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

        const iconElement = document.createElement('span'); // Assuming <span> or <i>
        iconElement.className = `icon ${iconClass}`; // e.g., 'icon icon-warning'
        iconWrapper.appendChild(iconElement);

        return iconWrapper;
    }

    /**
     * Creates the close (X) button for sticky notifications.
     * @param {string} id - The ID of the notification to dismiss.
     * @returns {HTMLElement} The close button element.
     * @private
     */
    _createCloseButton(id) {
        const me = this;
        const closeButton = document.createElement('button');
        closeButton.className = 'notification__close-button';
        closeButton.innerHTML = '&times;'; // Simple 'X'
        closeButton.setAttribute('aria-label', TranslationService.translate('common.close')); // Accessibility

        closeButton.onclick = () => {
            me._notificationService.dismiss(id);
        };

        return closeButton;
    }

    /**
     * Creates the button container, including default (OK/Cancel) and custom buttons.
     * @param {object} options - The notification options.
     * @returns {HTMLElement|null} The buttons container element or null if no buttons.
     * @private
     */
    _createButtonsElement(options) {
        const me = this;
        const customButtons = options.buttons || [];
        const standardButtons = [];

        // Add standard buttons first, so they appear (e.g., in a snackbar) in a logical order.

        // Add Cancel button
        if (options.showCancelButton) {
            standardButtons.push({
                text: TranslationService.translate('common.cancel'),
                cssClass: 'notification__button--cancel',
                onClick: id => me._notificationService.dismiss(id) // Default action
            });
        }

        // Add OK button
        if (options.showOKButton) {
            standardButtons.push({
                text: TranslationService.translate('common.ok'),
                cssClass: 'notification__button--ok',
                onClick: id => me._notificationService.dismiss(id) // Default action
            });
        }

        // Combine standard and custom buttons
        // Custom buttons override standard button text/actions if you provide them
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

            buttonElement.textContent = buttonOptions.text; // Text is provided by service or translated

            // The service already wraps the onClick to pass the ID
            buttonElement.onclick = buttonOptions.onClick;

            buttonsContainer.appendChild(buttonElement);
        });

        return buttonsContainer;
    }

    /**
     * Removes any notification containers that are empty.
     * @private
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
