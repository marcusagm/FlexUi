import { ModalInstance } from './ModalInstance.js';

/**
 * Description:
 * Provides a complete, Singleton BEM-compliant service for managing modal windows.
 * It handles stacking, accessibility (focus trap, ARIA), scroll locking,
 * async data resolution, global defaults, instance ID management, and advanced
 * UI positioning (like drawers/side-modals).
 *
 * Properties summary:
 * - _container {HTMLElement} : The main DOM element holding all modals.
 * - _backdrop {HTMLElement} : The backdrop element.
 * - _modalStack {Array<ModalInstance>} : The stack of open modals (for navigation).
 * - _previousActiveElement {HTMLElement} : Element to restore focus to.
 * - _animationDuration {number} : Duration of modal animations in ms.
 * - _globalDefaultOptions {object} : Stores default options for all modals.
 * - _throttledResizeHandler {Function} : The throttled resize event handler.
 *
 * Typical usage:
 * import ModalService from './ModalService.js';
 * import './ModalInstance.js'; // Ensure ModalInstance is loaded
 *
 * // Set defaults for the entire app (optional)
 * ModalService.setDefaultOptions({
 * backdrop: 'blur',
 * position: 'right'
 * });
 *
 * // Open a modal
 * ModalService.open({
 * id: 'my-modal',
 * title: 'Hello',
 * content: 'This is a modal.'
 * });
 *
 * Notes / Additional:
 * - This class is a Singleton. Use ModalService.getInstance() to access it.
 * - It depends on the ModalInstance class being available.
 * - It is tightly coupled to the BEM CSS structure defined in 'modal-styles.css'.
 */
export class ModalService {
    /**
     * @type {HTMLElement}
     * @description The main container element injected into the body.
     * @private
     */
    _container = null;

    /**
     * @type {HTMLElement}
     * @description The backdrop element.
     * @private
     */
    _backdrop = null;

    /**
     * @type {Array<ModalInstance>}
     * @description The stack of open modal instances.
     * @private
     */
    _modalStack = [];

    /**
     * @type {HTMLElement}
     * @description The element that had focus before the first modal was opened.
     * @private
     */
    _previousActiveElement = null;

    /**
     * @type {number}
     * @description Animation duration in ms (must match CSS).
     * @private
     */
    _animationDuration = 200; // 200ms default, CSS transition is 0.25s

    /**
     * @type {string}
     * @description CSS selectors for finding focusable elements.
     * @private
     */
    _focusableSelectors = [
        'a[href]:not([disabled])',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    /**
     * @type {object}
     * @description Stores global default options.
     * @private
     */
    _globalDefaultOptions = {};

    /**
     * @type {Function}
     * @description Throttled version of the resize handler.
     * @private
     */
    _throttledResizeHandler = null;

    /**
     * @type {ModalService}
     * @description The singleton instance.
     * @private
     * @static
     */
    static _instance = null;

    /**
     * Private constructor for Singleton pattern.
     * @private
     */
    constructor() {
        const me = this;
        if (ModalService._instance) {
            throw new Error('ModalService is a Singleton. Use ModalService.getInstance().');
        }
        me._initialize();
    }

    /**
     * Gets the singleton instance of the ModalService.
     * @returns {ModalService} The singleton instance.
     */
    static getInstance() {
        if (!ModalService._instance) {
            ModalService._instance = new ModalService();
        }
        return ModalService._instance;
    }

    /**
     * Initializes the service, creates DOM elements, and attaches global listeners.
     * @private
     */
    _initialize() {
        const me = this;
        const container = document.createElement('div');
        container.className = 'modal-container';
        me.setContainer(container);

        const backdrop = document.createElement('div');
        backdrop.className = 'modal__backdrop';
        me.setBackdrop(backdrop);

        me.getContainer().appendChild(me.getBackdrop());
        document.body.appendChild(me.getContainer());

        // Attach global listeners
        me._backdrop.addEventListener('click', me._onBackdropClick.bind(me));
        document.addEventListener('keydown', me._onGlobalKeydown.bind(me));

        // [FEATURE] Attach throttled resize listener
        me._throttledResizeHandler = me._throttle(me._onWindowResize.bind(me), 150);
        window.addEventListener('resize', me._throttledResizeHandler);
    }

    // --- Getters / Setters ---

    /** * @param {HTMLElement} element
     * @description Sets the container element.
     */
    setContainer(element) {
        const me = this;
        me._container = element;
    }
    /** * @returns {HTMLElement}
     * @description Gets the container element.
     */
    getContainer() {
        const me = this;
        return me._container;
    }

    /** * @param {HTMLElement} element
     * @description Sets the backdrop element.
     */
    setBackdrop(element) {
        const me = this;
        me._backdrop = element;
    }
    /** * @returns {HTMLElement}
     * @description Gets the backdrop element.
     */
    getBackdrop() {
        const me = this;
        return me._backdrop;
    }

    /** * @returns {number}
     * @description Gets the animation duration in ms.
     */
    getAnimationDuration() {
        const me = this;
        return me._animationDuration;
    }

    /** * @returns {ModalInstance | null}
     * @description Gets the currently active (top-most) modal instance.
     */
    getActiveModal() {
        const me = this;
        return me._modalStack.length > 0 ? me._modalStack[me._modalStack.length - 1] : null;
    }

    // --- Public API Methods ---

    /**
     * [FEATURE] Sets default options for all subsequent modal 'open' calls.
     * Options are merged with system defaults.
     * @param {object} options - An options object (see `open()` for details).
     */
    setDefaultOptions(options = {}) {
        const me = this;
        me._globalDefaultOptions = { ...me._globalDefaultOptions, ...options };
    }

    /**
     * Opens a new modal window.
     * @param {object} options - The modal configuration object.
     * @param {string} [options.id] - A unique ID for this modal instance.
     * @param {string} [options.title] - The text for the modal header.
     * @param {string|HTMLElement|object} options.content - The modal content.
     * Can be an HTML string, a DOM element, or an object:
     * { viewUrl: '/path.html', controller: (api, el, data) => {} }
     * { controller: (api, el, data) => {} } (if using 'resolve' only)
     * @param {string} [options.size='medium'] - 'auto', 'small', 'medium', 'large', 'fullscreen'.
     * @param {string} [options.position='center'] - 'center', 'right', 'left', 'top', 'bottom'.
     * @param {boolean} [options.closeButton=true] - Show the 'X' close button.
     * @param {boolean} [options.closeOnBackdropClick=true] - Close when backdrop is clicked.
     * @param {boolean} [options.closeOnEscape=true] - Close when Escape key is pressed.
     * @param {string} [options.backdrop='visible'] - 'visible', 'blur', 'none'.
     * @param {Array<object>} [options.buttons] - Array of button config objects.
     * Example: { text: 'OK', class: 'modal__button', action: 'resolve', value: true }
     * @param {string} [options.footerText] - Text for the bottom-left of the footer.
     * @param {boolean} [options.draggable=false] - If the modal header is draggable.
     * @param {string} [options.className] - A custom CSS class to add to the modal window.
     * @param {string} [options.initialFocus] - CSS selector for the element to focus on open.
     * @param {object<Promise>} [options.resolve] - An object of promises to resolve before loading content.
     * Example: { user: fetchUser(1) }
     * @param {Function} [options.onBeforeOpen] - Hook: before modal is created. Receives (api).
     * @param {Function} [options.onOpen] - Hook: after modal is visible. Receives (api, resolvedData).
     * @param {Function} [options.onBeforeClose] - Hook: before modal closes. Return false to cancel. Receives (reason, value, api).
     * @param {Function} [options.onClose] - Hook: after modal is destroyed. Receives (value, api).
     * @returns {Promise} A promise that resolves/rejects when the modal is closed.
     */
    open(options = {}) {
        const me = this;

        // [FEATURE] Merge options: Hardcoded < Global < Instance
        const hardcodedDefaults = {
            id: null,
            title: null,
            content: '',
            size: 'medium',
            position: 'center',
            closeButton: true,
            closeOnBackdropClick: true,
            closeOnEscape: true,
            backdrop: 'visible',
            buttons: [],
            footerText: null,
            draggable: false,
            className: null,
            initialFocus: null,
            resolve: null,
            showBackButton: me._modalStack.length > 0,
            onBeforeOpen: null,
            onOpen: null,
            onBeforeClose: null,
            onClose: null
        };
        const modalOptions = {
            ...hardcodedDefaults,
            ...me._globalDefaultOptions,
            ...options
        };

        // [FEATURE] Check for duplicate ID
        if (modalOptions.id && me.isIdOpen(modalOptions.id)) {
            const errorMsg = `[ModalService] Modal with ID "${modalOptions.id}" is already open.`;
            console.warn(errorMsg);
            return Promise.reject(errorMsg);
        }

        // Handle first modal opening
        if (me._modalStack.length === 0) {
            me._previousActiveElement = document.activeElement;
            me._container.classList.add('modal-container--is-open');
            me._applyScrollLock();
        }

        // Hide current active modal (if navigating)
        const currentActive = me.getActiveModal();
        if (currentActive) {
            currentActive.hide();
        }

        // Update backdrop style
        me._backdrop.className = 'modal__backdrop';
        if (modalOptions.backdrop === 'blur') {
            me._backdrop.classList.add('modal__backdrop--blur');
        } else if (modalOptions.backdrop === 'none') {
            me._backdrop.classList.add('modal__backdrop--none');
        }

        // Create and stack new instance
        const modalInstance = new ModalInstance(modalOptions, me);
        me._modalStack.push(modalInstance);

        // Add to DOM and show
        me._container.appendChild(modalInstance.element);
        modalInstance.show();

        return modalInstance.promise;
    }

    /**
     * Closes the *active* modal and resolves its promise.
     * @param {*} [value] - The value to resolve the promise with.
     */
    close(value) {
        const me = this;
        const activeModal = me.getActiveModal();
        if (!activeModal || activeModal.isClosing) {
            return;
        }

        if (activeModal.destroy('resolve', value)) {
            me._modalStack.pop();
            me._updateAfterClose();
        }
    }

    /**
     * Closes the *active* modal and rejects (dismisses) its promise.
     * @param {*} [reason] - The reason for dismissal (e.g., 'backdrop', 'escape').
     */
    dismiss(reason) {
        const me = this;
        const activeModal = me.getActiveModal();
        if (!activeModal || activeModal.isClosing) {
            return;
        }

        if (activeModal.destroy('dismiss', reason)) {
            me._modalStack.pop();
            me._updateAfterClose();
        }
    }

    /**
     * Navigates back one step in the modal stack.
     * This is an alias for dismissing the current modal.
     */
    back() {
        const me = this;
        me.dismiss('back');
    }

    /**
     * [FEATURE] Gets a modal instance by its unique ID.
     * @param {string} id The modal ID.
     * @returns {ModalInstance | null} The instance or null if not found.
     */
    getById(id) {
        const me = this;
        return me._modalStack.find(modal => modal.options.id === id) || null;
    }

    /**
     * [FEATURE] Checks if a modal with a given ID is currently open.
     * @param {string} id The modal ID.
     * @returns {boolean}
     */
    isIdOpen(id) {
        const me = this;
        return !!me.getById(id);
    }

    /**
     * [FEATURE] Closes a modal by its ID, regardless of its position in the stack.
     * @param {string} id The modal ID.
     * @param {*} [value] The value to resolve/reject the promise with.
     * @param {string} [reason='resolve'] 'resolve' or 'dismiss'.
     */
    closeById(id, value, reason = 'resolve') {
        const me = this;
        const modalToClose = me.getById(id);
        if (!modalToClose) {
            return;
        }

        const isActive = modalToClose === me.getActiveModal();

        if (modalToClose.destroy(reason, value)) {
            // Remove from stack
            me._modalStack = me._modalStack.filter(modal => modal.options.id !== id);
            // Only update UI if the *active* modal was the one closed
            if (isActive) {
                me._updateAfterClose();
            }
        }
    }

    // --- Presets ---

    /**
     * Shows a simple alert modal.
     * @param {string} message - The alert message.
     * @param {string} [title='Alert'] - The modal title.
     * @returns {Promise} Resolves with `true` when 'OK' is clicked.
     */
    alert(message, title = 'Alert') {
        const me = this;
        return me.open({
            title: title,
            content: `<p>${message}</p>`,
            size: 'small',
            closeOnBackdropClick: false,
            buttons: [
                {
                    text: 'OK',
                    class: 'modal__button modal__button--primary',
                    action: 'resolve',
                    value: true
                }
            ]
        });
    }

    /**
     * Shows a confirmation modal.
     * @param {string} message - The confirmation message.
     * @param {string} [title='Confirm'] - The modal title.
     * @returns {Promise<boolean>} Resolves with true (OK) or false (Cancel).
     */
    confirm(message, title = 'Confirm') {
        const me = this;
        return me.open({
            title: title,
            content: `<p>${message}</p>`,
            size: 'small',
            closeOnBackdropClick: false,
            closeOnEscape: false,
            buttons: [
                {
                    text: 'Cancel',
                    class: 'modal__button modal__button--secondary',
                    action: 'resolve',
                    value: false
                },
                {
                    text: 'OK',
                    class: 'modal__button modal__button--primary',
                    action: 'resolve',
                    value: true
                }
            ]
        });
    }

    /**
     * Shows a prompt modal with a text input.
     * @param {string} message - The prompt message.
     * @param {string} [title='Prompt'] - The modal title.
     * @param {string} [defaultValue=''] - The default value for the input.
     * @returns {Promise<string|null>} Resolves with the input value or null if canceled.
     */
    prompt(message, title = 'Prompt', defaultValue = '') {
        const me = this;
        const inputId = `modal-prompt-input-${Date.now()}`;
        const content = `
      <div class="modal__prompt">
        <label for="${inputId}" class="modal__prompt-label">${message}</label>
        <input type="text" id="${inputId}" class="modal__prompt-input" value="${defaultValue}">
      </div>
    `;
        return me.open({
            title: title,
            content: content,
            size: 'small',
            closeOnBackdropClick: false,
            closeOnEscape: false,
            initialFocus: `#${inputId}`, // Focus the input
            buttons: [
                {
                    text: 'Cancel',
                    class: 'modal__button modal__button--secondary',
                    action: 'resolve',
                    value: null
                },
                {
                    text: 'OK',
                    class: 'modal__button modal__button--primary',
                    action: api => {
                        const value = api.contentElement.querySelector('input').value;
                        api.close(value);
                    }
                }
            ]
        });
    }

    // --- Private Helpers ---

    /**
     * Manages stack and UI after a modal is closed.
     * If a modal was closed from the middle of the stack,
     * this only runs if it was the *active* modal.
     * @private
     */
    _updateAfterClose() {
        const me = this;
        const newActiveModal = me.getActiveModal();

        if (newActiveModal) {
            // Show the previous modal in the stack
            newActiveModal.show();
            newActiveModal.focus();

            // Update backdrop to match the new active modal
            me._backdrop.className = 'modal__backdrop';
            if (newActiveModal.options.backdrop === 'blur') {
                me._backdrop.classList.add('modal__backdrop--blur');
            } else if (newActiveModal.options.backdrop === 'none') {
                me._backdrop.classList.add('modal__backdrop--none');
            }
        } else {
            // No modals left, close the service
            me._container.classList.remove('modal-container--is-open');
            me._applyScrollUnlock();

            // Restore focus (A11y)
            if (me._previousActiveElement) {
                me._previousActiveElement.focus();
                me._previousActiveElement = null;
            }
        }
    }

    /**
     * Gets a list of focusable elements within a parent.
     * @param {HTMLElement} parentElement - The element to search within.
     * @returns {Array<HTMLElement>}
     * @public (Used by ModalInstance)
     */
    getFocusableElements(parentElement) {
        const me = this;
        if (!parentElement) return [];
        return Array.from(parentElement.querySelectorAll(me._focusableSelectors));
    }

    // --- Global Event Handlers ---

    /**
     * Handles 'Escape' key press and 'Tab' focus trapping.
     * @param {KeyboardEvent} event
     * @private
     */
    _onGlobalKeydown(event) {
        const me = this;
        if (event.key !== 'Escape' && event.key !== 'Tab') {
            return;
        }

        const activeModal = me.getActiveModal();
        if (!activeModal || activeModal.isClosing) return;

        if (event.key === 'Escape') {
            if (activeModal.options.closeOnEscape) {
                me.dismiss('escape');
            }
        }
        if (event.key === 'Tab') {
            me._handleFocusTrap(event);
        }
    }

    /**
     * Handles clicks on the backdrop.
     * @private
     */
    _onBackdropClick() {
        const me = this;
        if (me._modalStack.length === 0) {
            return;
        }

        const activeModal = me.getActiveModal();
        if (activeModal.options.closeOnBackdropClick) {
            me.dismiss('backdrop');
        }
    }

    /**
     * [FEATURE] Handles the throttled window resize event.
     * Iterates over all open modals and calls their updatePosition method.
     * @private
     */
    _onWindowResize() {
        const me = this;
        if (me._modalStack.length === 0) {
            return;
        }
        // Update position for all open modals (needed for stack)
        me._modalStack.forEach(modalInstance => {
            modalInstance.updatePosition();
        });
    }

    /**
     * Traps Tab focus within the active modal.
     * @param {KeyboardEvent} event
     * @private
     */
    _handleFocusTrap(event) {
        const me = this;
        const activeModal = me.getActiveModal();
        if (!activeModal) return;

        const focusableElements = me.getFocusableElements(activeModal.element);
        if (focusableElements.length === 0) {
            event.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                lastElement.focus();
                event.preventDefault();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                firstElement.focus();
                event.preventDefault();
            }
        }
    }

    // --- Utility Helpers ---

    /**
     * [FEATURE] Utility to throttle function execution.
     * @param {Function} func The function to throttle.
     * @param {number} limit The delay in milliseconds.
     * @returns {Function} The throttled function.
     * @private
     */
    _throttle(func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }

    /**
     * Gets the width of the browser's scrollbar.
     * @returns {number} Scrollbar width in pixels.
     * @private
     */
    _getScrollbarWidth() {
        return window.innerWidth - document.documentElement.clientWidth;
    }

    /**
     * Applies scroll lock to the body.
     * @private
     */
    _applyScrollLock() {
        const me = this;
        const scrollbarWidth = me._getScrollbarWidth();
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.classList.add('modal-scroll-lock');
    }

    /**
     * Removes scroll lock from the body.
     * @private
     */
    _applyScrollUnlock() {
        document.body.style.paddingRight = '';
        document.body.classList.remove('modal-scroll-lock');
    }
}
