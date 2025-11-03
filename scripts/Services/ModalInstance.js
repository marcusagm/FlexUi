/**
 * Description:
 * Manages the state, DOM, and promise of a single modal window.
 * This is an internal helper class controlled by ModalService and is not
 * intended for direct instantiation by the developer.
 *
 * Properties summary:
 * - _options {object} : The configuration options for this modal.
 * - _service {ModalService} : A reference to the parent service.
 * - _element {HTMLElement} : The main DOM element for this modal window.
 * - _contentElement {HTMLElement} : The content area DOM element.
 * - _resolve {Function} : The 'resolve' function for the modal's promise.
 * - _reject {Function} : The 'reject' function for the modal's promise.
 * - _promise {Promise} : The promise returned by `service.open()`.
 * - _isClosing {boolean} : Tracks if the modal is currently closing.
 * - _resolvedData {object|null} : Stores the data from the 'resolve' option.
 *
 * Typical usage:
 * This class is instantiated internally by ModalService.
 * // const modalInstance = new ModalInstance(options, service);
 *
 * Notes / Additional:
 * - This class's lifecycle is fully managed by ModalService.
 * - It is tightly coupled to the ModalService and the BEM CSS structure.
 * @internal
 */
export class ModalInstance {
    /**
     * @type {object}
     * @description The configuration options for this modal.
     * @private
     */
    _options = {};

    /**
     * @type {ModalService}
     * @description A reference to the parent service.
     * @private
     */
    _service = null;

    /**
     * @type {HTMLElement}
     * @description The main DOM element for this modal window (the .modal block).
     * @private
     */
    _element = null;

    /**
     * @type {HTMLElement}
     * @description The content area DOM element (.modal__content).
     * @private
     */
    _contentElement = null;

    /**
     * @type {Function}
     * @description The 'resolve' function for the modal's promise.
     * @private
     */
    _resolve = null;

    /**
     * @type {Function}
     * @description The 'reject' function for the modal's promise.
     * @private
     */
    _reject = null;

    /**
     * @type {Promise}
     * @description The promise returned by `service.open()`.
     * @private
     */
    _promise = null;

    /**
     * @type {boolean}
     * @description Tracks if the modal is currently closing.
     * @private
     */
    _isClosing = false;

    /**
     * @type {object|null}
     * @description Stores the data from the 'resolve' option.
     * @private
     */
    _resolvedData = null;

    /**
     * Creates an instance of ModalInstance.
     * @param {object} options - The modal configuration.
     * @param {ModalService} service - The parent ModalService.
     */
    constructor(options, service) {
        const me = this;
        me._options = options;
        me._service = service;
        me._isClosing = false;

        me._promise = new Promise((resolve, reject) => {
            me._resolve = resolve;
            me._reject = reject;
        });

        // Run the 'beforeOpen' hook, passing the API
        if (typeof me._options.onBeforeOpen === 'function') {
            me._options.onBeforeOpen(me.getApi());
        }

        me._buildDOM();

        // Check if we have async data to resolve before loading content
        if (me._options.resolve && Object.keys(me._options.resolve).length > 0) {
            me._handleAsyncResolve();
        } else {
            // No resolve, load content and open immediately
            me._loadContent();
            me._triggerOpenHooks();
        }
    }

    // --- Public Getters ---

    /**
     * @returns {Promise} The promise associated with this modal.
     */
    get promise() {
        return this._promise;
    }

    /**
     * @returns {HTMLElement} The main DOM element.
     */
    get element() {
        return this._element;
    }

    /**
     * @returns {object} The modal options.
     */
    get options() {
        return this._options;
    }

    /**
     * @returns {boolean} True if the modal is in the process of closing.
     */
    get isClosing() {
        return this._isClosing;
    }

    // --- DOM and Content ---

    /**
     * Builds the modal shell (header, footer, content area).
     * @private
     */
    _buildDOM() {
        const me = this;
        me._element = document.createElement('div');
        me._element.className = 'modal';

        // ARIA attributes
        me._element.setAttribute('role', 'dialog');
        me._element.setAttribute('aria-modal', 'true');
        const titleId = `modal-title-${Date.now()}`;
        if (me._options.title) {
            me._element.setAttribute('aria-labelledby', titleId);
        }

        // Add position and size classes
        me._element.classList.add(`modal--position-${me._options.position}`);
        me._element.classList.add(`modal--size-${me._options.size}`);

        // Add custom class
        if (me._options.className) {
            me._element.classList.add(me._options.className);
        }

        // Set initial transform for centered modals
        if (me._options.position === 'center') {
            me._element.style.transform = 'translate(-50%, -50%) scale(0.95)';
        }

        // Build Header
        if (me._options.title || me._options.closeButton) {
            const header = me._buildHeader(titleId);
            me._element.appendChild(header);

            if (me._options.draggable) {
                header.classList.add('modal__header--draggable');
                me._makeDraggable(header, me._element);
            }
        }

        // Build Content Area
        me._contentElement = document.createElement('main');
        me._contentElement.className = 'modal__content';
        me._element.appendChild(me._contentElement);

        // Build Footer
        if (me._options.footerText || (me._options.buttons && me._options.buttons.length > 0)) {
            me._element.appendChild(me._buildFooter());
        }
    }

    /**
     * Builds the modal header.
     * @param {string} titleId - The unique ID for the title element (for ARIA).
     * @returns {HTMLElement} The header element.
     * @private
     */
    _buildHeader(titleId) {
        const me = this;
        const header = document.createElement('header');
        header.className = 'modal__header';

        const titleContainer = document.createElement('div');
        titleContainer.className = 'modal__nav';

        // Back button (Stack Navigation)
        if (me._options.showBackButton) {
            const backButton = document.createElement('button');
            backButton.className = 'modal__back-button';
            backButton.innerHTML = '&larr;';
            backButton.setAttribute('aria-label', 'Back');
            backButton.onclick = () => me._service.back();
            titleContainer.appendChild(backButton);
        }

        // Title
        if (me._options.title) {
            const title = document.createElement('h2');
            title.className = 'modal__title';
            title.id = titleId;
            title.textContent = me._options.title;
            titleContainer.appendChild(title);
        }

        header.appendChild(titleContainer);

        // Close Button
        if (me._options.closeButton) {
            const closeButton = document.createElement('button');
            closeButton.className = 'modal__close-button';
            closeButton.innerHTML = '&times;';
            closeButton.setAttribute('aria-label', 'Close');
            closeButton.onclick = () => me._service.dismiss('closeButton');
            header.appendChild(closeButton);
        }
        return header;
    }

    /**
     * Builds the modal footer.
     * @returns {HTMLElement} The footer element.
     * @private
     */
    _buildFooter() {
        const me = this;
        const footer = document.createElement('footer');
        footer.className = 'modal__footer';

        // Footer Text
        const footerText = document.createElement('span');
        footerText.className = 'modal__footer-text';
        footerText.textContent = me._options.footerText || '';
        footer.appendChild(footerText);

        // Footer Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal__footer-buttons';

        if (me._options.buttons) {
            me._options.buttons.forEach(btnOptions => {
                const button = document.createElement('button');
                button.textContent = btnOptions.text;
                button.className = btnOptions.class || 'modal__button modal__button--secondary';

                button.onclick = () => {
                    if (typeof btnOptions.action === 'function') {
                        btnOptions.action(me.getApi());
                    } else if (btnOptions.action === 'dismiss') {
                        me._service.dismiss(btnOptions.value || 'dismiss');
                    } else {
                        // Default is 'resolve'
                        me._service.close(btnOptions.value);
                    }
                };
                buttonContainer.appendChild(button);
            });
        }

        footer.appendChild(buttonContainer);
        return footer;
    }

    /**
     * [FEATURE] Displays a spinner, waits for all promises in `options.resolve`
     * and then calls _loadContent and _triggerOpenHooks.
     * @private
     */
    _handleAsyncResolve() {
        const me = this;

        // 1. Show spinner
        me._contentElement.innerHTML = '<div class="modal__spinner"></div>';

        // 2. Prepare promises
        const resolvers = me._options.resolve;
        const keys = Object.keys(resolvers);
        const promises = keys.map(key => resolvers[key]);

        // 3. Wait for all
        Promise.all(promises)
            .then(results => {
                // 4. Map results back to an object
                me._resolvedData = {};
                keys.forEach((key, index) => {
                    me._resolvedData[key] = results[index];
                });

                // 5. Load content and open
                me._loadContent(me._resolvedData);
                me._triggerOpenHooks();
            })
            .catch(error => {
                // 6. Handle error
                console.error('[ModalService] Error in "resolve" block:', error);
                me._contentElement.innerHTML = `<p style="color: red; padding: 10px;">Error loading modal data.</p>`;
                me._triggerOpenHooks(); // Still open the (error) modal
            });
    }

    /**
     * Loads content into the modal.
     * @param {object|null} [resolvedData=null] - Data from the async resolve.
     * @private
     */
    _loadContent(resolvedData = null) {
        const me = this;
        const content = me._options.content;
        me._contentElement.innerHTML = ''; // Clear spinner or previous

        // 1. String or HTML content
        if (typeof content === 'string') {
            me._contentElement.innerHTML = content;
        }
        // 2. DOM Element content
        else if (content instanceof HTMLElement || content instanceof DocumentFragment) {
            me._contentElement.appendChild(content);
        }
        // 3. View/Controller object
        else if (typeof content === 'object' && content !== null) {
            // 3a. Has viewUrl to fetch
            if (content.viewUrl) {
                me._contentElement.innerHTML = '<div class="modal__spinner"></div>';

                window
                    .fetch(content.viewUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Failed to load view: ${response.statusText}`);
                        }
                        return response.text();
                    })
                    .then(html => {
                        me._contentElement.innerHTML = html;
                        // Pass resolvedData to controller
                        if (typeof content.controller === 'function') {
                            content.controller(me.getApi(), me._contentElement, resolvedData);
                        }
                    })
                    .catch(error => {
                        console.error('[ModalService] Failed to load dynamic content.', error);
                        me._contentElement.innerHTML = `<p style="color: red;">Error loading content.</p>`;
                    });
            }
            // 3b. Has controller but no view (e.g., for resolve-only)
            else if (typeof content.controller === 'function') {
                content.controller(me.getApi(), me._contentElement, resolvedData);
            }
        }
        // 4. Fallback
        else {
            console.warn('[ModalService] Invalid content type provided.', content);
        }
    }

    /**
     * Triggers the onOpen hook and focus, after animation.
     * @private
     */
    _triggerOpenHooks() {
        const me = this;
        setTimeout(() => {
            // Pass resolvedData to onOpen hook
            if (typeof me._options.onOpen === 'function') {
                me._options.onOpen(me.getApi(), me._resolvedData);
            }
            me.focus();
        }, me._service.getAnimationDuration());
    }

    /**
     * Makes the modal draggable via its header.
     * @param {HTMLElement} header - The header element to drag.
     * @param {HTMLElement} windowEl - The window element to move.
     * @private
     */
    _makeDraggable(header, windowEl) {
        const me = this;
        let pos1 = 0,
            pos2 = 0,
            pos3 = 0,
            pos4 = 0;

        function dragMouseDown(event) {
            if (event.button !== 0) return; // Only drag with left mouse
            event.preventDefault();

            // Switch from transform to px positioning
            if (me._options.position === 'center') {
                const rect = windowEl.getBoundingClientRect();
                windowEl.style.transform = 'none';
                windowEl.style.left = `${rect.left}px`;
                windowEl.style.top = `${rect.top}px`;
            }

            pos3 = event.clientX;
            pos4 = event.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(event) {
            event.preventDefault();
            pos1 = pos3 - event.clientX;
            pos2 = pos4 - event.clientY;
            pos3 = event.clientX;
            pos4 = event.clientY;
            windowEl.style.top = windowEl.offsetTop - pos2 + 'px';
            windowEl.style.left = windowEl.offsetLeft - pos1 + 'px';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }

        header.onmousedown = dragMouseDown;
    }

    // --- Public API / Actions ---

    /**
     * Gets the limited API to pass to controllers and buttons.
     * @returns {object} The modal instance API.
     */
    getApi() {
        const me = this;
        return {
            close: value => me._service.close(value),
            dismiss: reason => me._service.dismiss(reason),
            back: () => me._service.back(),
            element: me._element,
            contentElement: me._contentElement,
            options: me._options,
            resolvedData: me._resolvedData // Data from 'resolve'
        };
    }

    /**
     * [FEATURE] Sets focus on the element specified in `options.initialFocus`,
     * otherwise falls back to the first focusable element.
     */
    focus() {
        const me = this;

        // 1. Try to find custom focus element
        if (me._options.initialFocus) {
            const customFocusEl = me._element.querySelector(me._options.initialFocus);
            if (customFocusEl) {
                customFocusEl.focus();
                return;
            }
            console.warn(
                `[ModalService] initialFocus selector "${me._options.initialFocus}" not found.`
            );
        }

        // 2. Fallback to first focusable element
        const focusableElements = me._service.getFocusableElements(me._element);
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        } else {
            // 3. Fallback to the window itself
            me._element.setAttribute('tabindex', '-1');
            me._element.focus();
        }
    }

    /**
     * Shows the modal window (with animation).
     * Used when first opening or returning in a stack.
     */
    show() {
        const me = this;
        me._element.classList.remove('modal--is-hidden');
        me._element.classList.remove('modal--is-leaving');
        me._element.style.display = 'flex';

        // Ensure transform is set correctly on show, unless it was dragged
        if (
            me._options.position === 'center' &&
            (!me._options.draggable ||
                !me._element.style.transform ||
                me._element.style.transform === 'none')
        ) {
            me._element.style.transform = 'translate(-50%, -50%) scale(0.95)';
        }

        // We use requestAnimationFrame to allow CSS transitions to apply
        requestAnimationFrame(() => {
            me._element.classList.add('modal--is-visible');
            // [FEATURE 3: POSITION]
            if (
                me._options.position === 'center' &&
                (!me._options.draggable || me._element.style.transform.includes('scale'))
            ) {
                me._element.style.transform = 'translate(-50%, -50%) scale(1)';
            }
        });
    }

    /**
     * Hides the modal window (no animation).
     * Used for navigating stacks.
     */
    hide() {
        const me = this;
        me._element.classList.remove('modal--is-visible');
        me._element.classList.add('modal--is-hidden');
        setTimeout(() => {
            if (me._element.classList.contains('modal--is-hidden')) {
                me._element.style.display = 'none';
            }
        }, me._service.getAnimationDuration());
    }

    /**
     * Destroys the modal window (with animation).
     * @param {string} reason - 'resolve' or 'dismiss'.
     * @param {*} [value] - The value to resolve/reject with.
     * @returns {boolean} True if closing, false if aborted by onBeforeClose.
     */
    destroy(reason, value) {
        const me = this;
        me._isClosing = true;

        // 1. Run 'beforeClose' hook
        if (typeof me._options.onBeforeClose === 'function') {
            const canClose = me._options.onBeforeClose(reason, value, me.getApi());
            if (canClose === false) {
                // Abort closing
                me._isClosing = false;
                return false;
            }
        }

        // 2. Play leaving animation
        me._element.classList.add('modal--is-leaving');
        me._element.classList.remove('modal--is-visible');

        // Reset transform for 'center' animation on close, if it wasn't dragged
        if (
            me._options.position === 'center' &&
            (!me._options.draggable || me._element.style.transform.includes('scale'))
        ) {
            me._element.style.transform = 'translate(-50%, -50%) scale(0.95)';
        }

        // 3. After animation, resolve/reject and remove DOM
        setTimeout(() => {
            // 4. Run 'onClose' hook
            if (typeof me._options.onClose === 'function') {
                me._options.onClose(value, me.getApi());
            }
            // 5. Resolve or reject the promise
            if (reason === 'resolve') {
                me._resolve(value);
            } else {
                // Um 'dismiss' (backdrop, 'X', escape) não é um erro.
                // É um fechamento não afirmativo, então resolvemos com 'undefined'.
                me._resolve(undefined);
            }
            // 6. Remove from DOM
            if (me._element.parentNode) {
                me._element.parentNode.removeChild(me._element);
            }
        }, me._service.getAnimationDuration());

        return true; // Signal to service to proceed
    }

    /**
     * [FEATURE] Called on window resize to keep draggable modals in viewport.
     */
    updatePosition() {
        const me = this;
        // Only apply to modals that are centered, draggable, AND have been dragged
        if (
            me._options.position !== 'center' ||
            !me._options.draggable ||
            me._element.style.transform.includes('scale')
        ) {
            return;
        }

        const elem = me._element;
        const rect = elem.getBoundingClientRect();
        const winWidth = document.documentElement.clientWidth;
        const winHeight = document.documentElement.clientHeight;

        let newTop = elem.offsetTop;
        let newLeft = elem.offsetLeft;

        // Check bounds and correct if necessary
        if (rect.right > winWidth) {
            newLeft = winWidth - rect.width;
        }
        if (rect.left < 0) {
            newLeft = 0;
        }
        if (rect.bottom > winHeight) {
            newTop = winHeight - rect.height;
        }
        if (rect.top < 0) {
            newTop = 0;
        }

        elem.style.top = `${Math.max(0, newTop)}px`;
        elem.style.left = `${Math.max(0, newLeft)}px`;
    }
}
