import { appBus } from '../../utils/EventBus.js';
import { EventTypes } from '../../constants/EventTypes.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * Provides a decoupled service for dispatching notification events (Toasts and Snackbars).
 * This class does not render the UI itself; it fires events on the internal EventBus (appBus).
 * A separate UI layer must listen for EventTypes.NOTIFICATION_SHOW and EventTypes.NOTIFICATION_DISMISS
 * to handle the actual rendering and removal of notification elements.
 *
 * Properties summary:
 * - _defaultOptions {object} : Default settings for all notifications.
 *
 * Typical usage:
 * // 1. Import and instantiate the service (e.g., in your app's entry point)
 * import { NotificationService } from './NotificationService.js';
 * const notificationService = new NotificationService({
 * position: 'top-right', // Set a default position
 * duration: 5000        // Set a default duration
 * });
 *
 * // 2. In your UI-layer (e.g., a "NotificationManager" component or main.js)
 * document.addEventListener('show-notification', (event) => {
 * const options = event.detail;
 * // Your code to create and render the notification DOM element
 * // e.g., myUIRenderer.createToast(options);
 * });
 *
 * document.addEventListener('dismiss-notification', (event) => {
 * const { id } = event.detail;
 * // Your code to find and remove the notification DOM element
 * // e.g., myUIRenderer.removeToast(id);
 * });
 *
 * // 3. In your application logic (e.g., after a form submission)
 * notificationService.success('Profile updated successfully!');
 *
 * // 4. For a more complex notification
 * notificationService.show({
 * message: 'This action is permanent.',
 * type: 'warning',
 * variant: 'snackbar',
 * sticky: true,
 * buttons: [
 * { text: 'Confirm', onClick: () => handleConfirm() },
 * { text: 'Cancel', onClick: (id) => notificationService.dismiss(id) }
 * ]
 * });
 *
 * Events:
 * - Emits: EventTypes.NOTIFICATION_SHOW (when a notification is requested)
 * - Emits: EventTypes.NOTIFICATION_DISMISS (when a notification should be closed)
 *
 * Dependencies:
 * - ../../utils/EventBus.js
 * - ../../constants/EventTypes.js
 */
export class NotificationService {
    /**
     * Default settings for all notifications.
     *
     * @private
     * @type {object}
     */
    _defaultOptions;

    /**
     * Initializes the service and sets the default notification options.
     *
     * @param {object} [initialOptions={}] - Optional initial default options to override the built-in defaults.
     */
    constructor(initialOptions = {}) {
        // Use the setter to initialize, as per guidelines
        this.defaultOptions = {
            variant: 'toast',
            type: 'info',
            position: 'top-right',
            duration: 4000,
            sticky: false,
            buttons: [],
            message: '',
            ...initialOptions
        };
    }

    /**
     * Gets the default notification options.
     *
     * @returns {object} The current default options.
     */
    get defaultOptions() {
        return this._defaultOptions;
    }

    /**
     * Sets and merges the default notification options.
     * Any new options provided will be merged with the existing defaults.
     *
     * @param {object} options - An object of options to merge with current defaults.
     * @returns {void}
     */
    set defaultOptions(options) {
        // Validation
        if (typeof options !== 'object' || options === null || Array.isArray(options)) {
            console.warn('NotificationService.defaultOptions: Input must be a valid object.');
            return;
        }
        // Coercion (merging)
        this._defaultOptions = { ...this._defaultOptions, ...options };
    }

    /**
     * Generates a simple unique ID for a notification.
     *
     * @returns {string} A unique identifier.
     * @private
     */
    _generateId() {
        return `notification_${generateId()}`;
    }

    /**
     * The core method to dispatch a notification event.
     * This prepares the notification options and fires the notification event.
     *
     * @param {object} options - Notification options.
     * @param {string} options.message - The text content of the notification.
     * @param {string} [options.type='info'] - Type: 'normal', 'info', 'success', 'warning', 'danger'.
     * @param {string} [options.variant='toast'] - Variant: 'toast', 'snackbar'.
     * @param {string} [options.position='top-right'] - Position: 'top-left', 'top-center', 'top-right',
     * 'bottom-left', 'bottom-center', 'bottom-right', 'center'.
     * @param {number} [options.duration=4000] - Time in ms before auto-dismiss. Ignored if 'sticky' is true.
     * @param {boolean} [options.sticky=false] - If true, the notification will not auto-dismiss.
     * @param {Array<object>} [options.buttons=[]] - Button objects. E.g., { text: 'string', onClick: function }
     * @returns {string} The ID of the created notification, which can be used with dismiss().
     */
    show(options) {
        const me = this;

        // Validation
        if (!options || typeof options !== 'object') {
            console.warn('NotificationService.show: Invalid options provided. Must be an object.');
            return null;
        }
        if (
            !options.message ||
            typeof options.message !== 'string' ||
            options.message.trim().length === 0
        ) {
            console.warn('NotificationService.show: Invalid or missing "message" property.');
            return null;
        }

        const notificationId = me._generateId();

        // Merge defaults with provided options
        const finalOptions = {
            ...me.defaultOptions,
            ...options,
            id: notificationId // Ensure ID is part of the event detail
        };

        // Normalize types (as requested)
        if (finalOptions.type === 'normal') {
            finalOptions.type = 'info';
        }

        // Auto-pass 'id' to button click handlers for convenience
        finalOptions.buttons = (finalOptions.buttons || []).map(button => {
            const originalOnClick = button.onClick;
            if (typeof originalOnClick !== 'function') {
                return button;
            }

            return {
                ...button,
                onClick: () => {
                    // Pass the ID to the original handler
                    originalOnClick(notificationId);
                }
            };
        });

        appBus.emit(EventTypes.NOTIFICATION_SHOW, finalOptions);

        return notificationId;
    }

    /**
     * Dispatches an event to dismiss a specific notification by its ID.
     * The UI layer is responsible for listening to the event and removing the corresponding element.
     *
     * @param {string} id - The ID of the notification to dismiss.
     * @returns {void}
     */
    dismiss(id) {
        // Validation
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            console.warn('NotificationService.dismiss: Invalid or missing ID.');
            return;
        }

        appBus.emit(EventTypes.NOTIFICATION_DISMISS, { id: id });
    }

    /**
     * Shows a toast notification (default variant).
     *
     * @param {object} options - Notification options (see show()). 'variant' is set to 'toast'.
     * @returns {string} The ID of the created notification.
     */
    showToast(options) {
        return this.show({ ...options, variant: 'toast' });
    }

    /**
     * Shows a snackbar notification.
     *
     * @param {object} options - Notification options (see show()). 'variant' is set to 'snackbar'.
     * @returns {string} The ID of the created notification.
     */
    showSnackbar(options) {
        return this.show({ ...options, variant: 'snackbar' });
    }

    /**
     * Shows an 'info' or 'normal' type notification.
     *
     * @param {string} message - The notification message.
     * @param {object} [options={}] - Additional options (see show()).
     * @returns {string} The ID of the created notification.
     */
    info(message, options = {}) {
        return this.show({ ...options, message: message, type: 'info' });
    }

    /**
     * Shows a 'success' type notification.
     *
     * @param {string} message - The notification message.
     * @param {object} [options={}] - Additional options (see show()).
     * @returns {string} The ID of the created notification.
     */
    success(message, options = {}) {
        return this.show({ ...options, message: message, type: 'success' });
    }

    /**
     * Shows a 'warning' type notification.
     *
     * @param {string} message - The notification message.
     * @param {object} [options={}] - Additional options (see show()).
     * @returns {string} The ID of the created notification.
     */
    warning(message, options = {}) {
        return this.show({ ...options, message: message, type: 'warning' });
    }

    /**
     * Shows a 'danger' (or 'error') type notification.
     *
     * @param {string} message - The notification message.
     * @param {object} [options={}] - Additional options (see show()).
     * @returns {string} The ID of the created notification.
     */
    danger(message, options = {}) {
        return this.show({ ...options, message: message, type: 'danger' });
    }
}
