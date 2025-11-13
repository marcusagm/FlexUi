import { ModalInstance } from './ModalInstance.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';
import { AlertView } from './presets/AlertView.js';
import { ConfirmView } from './presets/ConfirmView.js';
import { PromptView } from './presets/PromptView.js';
import { globalState } from '../GlobalStateService.js';

/**
 * Description:
 * Provides a complete, Singleton BEM-compliant service for managing modal windows.
 * It handles stacking, accessibility (focus trap, ARIA), scroll locking,
 * async data resolution, global defaults, instance ID management, and advanced
 * UI positioning (like drawers/side-modals).
 *
 * It also manages the 'modal-open' scope for the ShortcutService.
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
 * Dependencies:
 * - ./ModalInstance.js
 * - ../../utils/ThrottleRAF.js
 * - ./presets/AlertView.js
 * - ./presets/ConfirmView.js
 * - ./presets/PromptView.js
 * - ../GlobalStateService.js
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

        me._backdrop.addEventListener('click', me._onBackdropClick.bind(me));
        document.addEventListener('keydown', me._onGlobalKeydown.bind(me));

        me._throttledResizeHandler = throttleRAF(me._onWindowResize.bind(me));
        window.addEventListener('resize', me._throttledResizeHandler);
    }

    /**
     * <Container> setter.
     * @param {HTMLElement} element - The main container element.
     * @returns {void}
     */
    setContainer(element) {
        const me = this;
        me._container = element;
    }
    /**
     * <Container> getter.
     * @returns {HTMLElement} The container element.
     */
    getContainer() {
        const me = this;
        return me._container;
    }

    /**
     * <Backdrop> setter.
     * @param {HTMLElement} element - The backdrop element.
     * @returns {void}
     */
    setBackdrop(element) {
        const me = this;
        me._backdrop = element;
    }
    /**
     * <Backdrop> getter.
     * @returns {HTMLElement} The backdrop element.
     */
    getBackdrop() {
        const me = this;
        return me._backdrop;
    }

    /**
     * <AnimationDuration> getter.
     * @returns {number} The animation duration in ms.
     */
    getAnimationDuration() {
        const me = this;
        return me._animationDuration;
    }

    /**
     * <ActiveModal> getter.
     * @returns {ModalInstance | null} The currently active (top-most) modal instance.
     */
    getActiveModal() {
        const me = this;
        return me._modalStack.length > 0 ? me._modalStack[me._modalStack.length - 1] : null;
    }

    /**
     * Description:
     * Sets default options for all subsequent modal 'open' calls.
     * Options are merged with system defaults.
     *
     * @param {object} options - An options object (see `open()` for details).
     * @returns {void}
     */
    setDefaultOptions(options = {}) {
        const me = this;
        me._globalDefaultOptions = { ...me._globalDefaultOptions, ...options };
    }

    /**
     * Description:
     * Opens a new modal window.
     *
     * @param {object} options - The modal configuration object.
     * @param {string} [options.id] - A unique ID for this modal instance.
     * @param {string} [options.title] - The text for the modal header.
     * @param {string|HTMLElement|object} options.content - The modal content.
     * @param {string} [options.size='medium'] - 'auto', 'small', 'medium', 'large', 'fullscreen'.
     * @param {string} [options.position='center'] - 'center', 'right', 'left', 'top', 'bottom'.
     * @param {boolean} [options.closeButton=true] - Show the 'X' close button.
     * @param {boolean} [options.closeOnBackdropClick=true] - Close when backdrop is clicked.
     * @param {boolean} [options.closeOnEscape=true] - Close when Escape key is pressed.
     * @param {string} [options.backdrop='visible'] - 'visible', 'blur', 'none'.
     * @param {Array<object>} [options.buttons] - Array of button config objects.
     * @param {string} [options.footerText] - Text for the bottom-left of the footer.
     * @param {boolean} [options.draggable=false] - If the modal header is draggable.
     * @param {string} [options.className] - A custom CSS class to add to the modal window.
     * @param {string} [options.initialFocus] - CSS selector for the element to focus on open.
     * @param {object<Promise>} [options.resolve] - An object of promises to resolve before loading content.
     * @param {Function} [options.onBeforeOpen] - Hook: before modal is created. Receives (api).
     * @param {Function} [options.onOpen] - Hook: after modal is visible. Receives (api, resolvedData).
     * @param {Function} [options.onBeforeClose] - Hook: before modal closes. Return false to cancel. Receives (reason, value, api).
     * @param {Function} [options.onClose] - Hook: after modal is destroyed. Receives (value, api).
     * @returns {Promise} A promise that resolves/rejects when the modal is closed.
     */
    open(options = {}) {
        const me = this;

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

        if (modalOptions.id && me.isIdOpen(modalOptions.id)) {
            const errorMsg = `[ModalService] Modal with ID "${modalOptions.id}" is already open.`;
            console.warn(errorMsg);
            return Promise.reject(errorMsg);
        }

        if (me._modalStack.length === 0) {
            me._previousActiveElement = document.activeElement;
            me._container.classList.add('modal-container--is-open');
            me._applyScrollLock();

            const scopes = globalState.get('activeScopes') || [];
            if (!scopes.includes('modal-open')) {
                scopes.push('modal-open');
                globalState.set('activeScopes', scopes);
            }
        }

        const currentActive = me.getActiveModal();
        if (currentActive) {
            currentActive.hide();
        }

        me._backdrop.className = 'modal__backdrop';
        if (modalOptions.backdrop === 'blur') {
            me._backdrop.classList.add('modal__backdrop--blur');
        } else if (modalOptions.backdrop === 'none') {
            me._backdrop.classList.add('modal__backdrop--none');
        }

        const modalInstance = new ModalInstance(modalOptions, me);
        me._modalStack.push(modalInstance);

        me._container.appendChild(modalInstance.element);
        modalInstance.show();

        return modalInstance.promise;
    }

    /**
     * Description:
     * Closes the *active* modal and resolves its promise.
     *
     * @param {*} [value] - The value to resolve the promise with.
     * @returns {void}
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
     * Description:
     * Closes the *active* modal and rejects (dismisses) its promise.
     *
     * @param {*} [reason] - The reason for dismissal (e.g., 'backdrop', 'escape').
     * @returns {void}
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
     * Description:
     * Navigates back one step in the modal stack.
     * This is an alias for dismissing the current modal.
     *
     * @returns {void}
     */
    back() {
        const me = this;
        me.dismiss('back');
    }

    /**
     * Description:
     * Gets a modal instance by its unique ID.
     *
     * @param {string} id - The modal ID.
     * @returns {ModalInstance | null} The instance or null if not found.
     */
    getById(id) {
        const me = this;
        return me._modalStack.find(modal => modal.options.id === id) || null;
    }

    /**
     * Description:
     * Checks if a modal with a given ID is currently open.
     *
     * @param {string} id - The modal ID.
     * @returns {boolean}
     */
    isIdOpen(id) {
        const me = this;
        return !!me.getById(id);
    }

    /**
     * Description:
     * Closes a modal by its ID, regardless of its position in the stack.
     *
     * @param {string} id - The modal ID.
     * @param {*} [value] - The value to resolve/reject the promise with.
     * @param {string} [reason='resolve'] - 'resolve' or 'dismiss'.
     * @returns {void}
     */
    closeById(id, value, reason = 'resolve') {
        const me = this;
        const modalToClose = me.getById(id);
        if (!modalToClose) {
            return;
        }

        const isActive = modalToClose === me.getActiveModal();

        if (modalToClose.destroy(reason, value)) {
            me._modalStack = me._modalStack.filter(modal => modal.options.id !== id);
            if (isActive) {
                me._updateAfterClose();
            }
        }
    }

    // --- Presets ---

    /**
     * Description:
     * Shows a simple alert modal.
     *
     * @param {string} message - The alert message.
     * @param {string} [title='Alert'] - The modal title.
     * @returns {Promise} Resolves with `true` when 'OK' is clicked.
     */
    alert(message, title = 'Alert') {
        const me = this;
        const viewConfig = AlertView(message);
        return me.open({
            title: title,
            ...viewConfig
        });
    }

    /**
     * Description:
     * Shows a confirmation modal.
     *
     * @param {string} message - The confirmation message.
     * @param {string} [title='Confirm'] - The modal title.
     * @returns {Promise<boolean>} Resolves with true (OK) or false (Cancel).
     */
    confirm(message, title = 'Confirm') {
        const me = this;
        const viewConfig = ConfirmView(message);
        return me.open({
            title: title,
            ...viewConfig
        });
    }

    /**
     * Description:
     * Shows a prompt modal with a text input.
     *
     * @param {string} message - The prompt message.
     * @param {string} [title='Prompt'] - The modal title.
     * @param {string} [defaultValue=''] - The default value for the input.
     * @returns {Promise<string|null>} Resolves with the input value or null if canceled.
     */
    prompt(message, title = 'Prompt', defaultValue = '') {
        const me = this;
        const viewConfig = PromptView(message, defaultValue);
        return me.open({
            title: title,
            ...viewConfig
        });
    }

    // --- Private Helpers ---

    /**
     * Description:
     * Manages stack and UI after a modal is closed.
     *
     * @private
     * @returns {void}
     */
    _updateAfterClose() {
        const me = this;
        const newActiveModal = me.getActiveModal();

        if (newActiveModal) {
            newActiveModal.show();
            newActiveModal.focus();

            me._backdrop.className = 'modal__backdrop';
            if (newActiveModal.options.backdrop === 'blur') {
                me._backdrop.classList.add('modal__backdrop--blur');
            } else if (newActiveModal.options.backdrop === 'none') {
                me._backdrop.classList.add('modal__backdrop--none');
            }
        } else {
            me._container.classList.remove('modal-container--is-open');
            me._applyScrollUnlock();

            if (me._previousActiveElement) {
                me._previousActiveElement.focus();
                me._previousActiveElement = null;
            }

            const scopes = (globalState.get('activeScopes') || []).filter(s => s !== 'modal-open');
            globalState.set('activeScopes', scopes);
        }
    }

    /**
     * Description:
     * Gets a list of focusable elements within a parent.
     *
     * @param {HTMLElement} parentElement - The element to search within.
     * @returns {Array<HTMLElement>}
     * @public
     */
    getFocusableElements(parentElement) {
        const me = this;
        if (!parentElement) {
            return [];
        }
        return Array.from(parentElement.querySelectorAll(me._focusableSelectors));
    }

    // --- Global Event Handlers ---

    /**
     * Description:
     * Handles 'Escape' key press and 'Tab' focus trapping.
     *
     * @param {KeyboardEvent} event
     * @private
     * @returns {void}
     */
    _onGlobalKeydown(event) {
        const me = this;
        if (event.key !== 'Escape' && event.key !== 'Tab') {
            return;
        }

        const activeModal = me.getActiveModal();
        if (!activeModal || activeModal.isClosing) {
            return;
        }

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
     * Description:
     * Handles clicks on the backdrop.
     *
     * @private
     * @returns {void}
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
     * Description:
     * Handles the throttled window resize event.
     *
     * @private
     * @returns {void}
     */
    _onWindowResize() {
        const me = this;
        if (me._modalStack.length === 0) {
            return;
        }
        me._modalStack.forEach(modalInstance => {
            modalInstance.updatePosition();
        });
    }

    /**
     * Description:
     * Traps Tab focus within the active modal.
     *
     * @param {KeyboardEvent} event
     * @private
     * @returns {void}
     */
    _handleFocusTrap(event) {
        const me = this;
        const activeModal = me.getActiveModal();
        if (!activeModal) {
            return;
        }

        const focusableElements = me.getFocusableElements(activeModal.element);
        if (focusableElements.length === 0) {
            event.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                event.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                event.preventDefault();
            }
        }
    }

    /**
     * Description:
     * Gets the width of the browser's scrollbar.
     *
     * @returns {number} Scrollbar width in pixels.
     * @private
     */
    _getScrollbarWidth() {
        return window.innerWidth - document.documentElement.clientWidth;
    }

    /**
     * Description:
     * Applies scroll lock to the body.
     *
     * @private
     * @returns {void}
     */
    _applyScrollLock() {
        const me = this;
        const scrollbarWidth = me._getScrollbarWidth();
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.classList.add('modal-scroll-lock');
    }

    /**
     * Description:
     * Removes scroll lock from the body.
     *
     * @private
     * @returns {void}
     */
    _applyScrollUnlock() {
        document.body.style.paddingRight = '';
        document.body.classList.remove('modal-scroll-lock');
    }
}
