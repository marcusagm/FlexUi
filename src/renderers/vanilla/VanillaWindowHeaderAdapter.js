import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering ApplicationWindowHeader components in a Vanilla JS environment.
 * It encapsulates the DOM structure creation for the window title bar, including controls
 * for minimizing, maximizing, pinning, closing, and popping out.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaWindowHeaderAdapter();
 * const header = adapter.createHeaderElement('win-1');
 * adapter.buildStructure(header, 'My Title');
 * adapter.setPopoutState(header, true);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces BEM structure (.window-header, .window-header__title, etc.).
 * - Manages visual states for Tab Mode (docked) vs Window Mode (floating) vs Popout Mode.
 * - Provides accessors for control buttons to attach listeners.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaWindowHeaderAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaWindowHeaderAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM element for the Window Header.
     *
     * @param {string} id - The unique ID of the window.
     * @returns {HTMLElement} The root header element.
     * @throws {Error} If the ID is invalid.
     */
    createHeaderElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaWindowHeaderAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const element = me.createElement('div', {
            className: 'window-header',
            id: `window-header-${id}`
        });

        return element;
    }

    /**
     * Builds the internal structure (Title + Controls) of the header.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {string} title - The initial title text.
     * @returns {void}
     */
    buildStructure(headerElement, title) {
        const me = this;
        if (!(headerElement instanceof HTMLElement)) {
            console.warn(
                `[VanillaWindowHeaderAdapter] Invalid headerElement assignment (${headerElement}). Must be an HTMLElement.`
            );
            return;
        }

        const titleElement = me.createElement('span', {
            className: 'window-header__title'
        });
        titleElement.textContent = title || '';
        me.mount(headerElement, titleElement);

        const controlsContainer = me.createElement('div', {
            className: 'window-header__controls'
        });

        const popoutButton = me._createButton('popout', '↗', 'Popout Window');
        const pinButton = me._createButton('pin', '📌', 'Always on Top');
        const minimizeButton = me._createButton('minimize', '−', 'Minimize');
        const maximizeButton = me._createButton('maximize', '□', 'Maximize');
        const closeButton = me._createButton('close', '×', 'Close');
        closeButton.classList.add('window-header__btn--close');

        me.mount(controlsContainer, popoutButton);
        me.mount(controlsContainer, pinButton);
        me.mount(controlsContainer, minimizeButton);
        me.mount(controlsContainer, maximizeButton);
        me.mount(controlsContainer, closeButton);

        me.mount(headerElement, controlsContainer);
    }

    /**
     * Updates the text content of the title element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {string} title - The new title text.
     * @returns {void}
     */
    updateTitle(headerElement, title) {
        if (!(headerElement instanceof HTMLElement)) return;

        const titleElement = headerElement.querySelector('.window-header__title');
        if (titleElement) {
            titleElement.textContent = title || '';
        }
    }

    /**
     * Toggles the header display mode between Tabbed (Docked) and Window (Floating).
     * In Tab mode, irrelevant controls (Pin, Min, Max, Popout) are hidden.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} isTabMode - True for tabbed mode, false for window mode.
     * @returns {void}
     */
    setTabMode(headerElement, isTabMode) {
        const me = this;
        if (!(headerElement instanceof HTMLElement)) return;

        const pinBtn = me.getPinButton(headerElement);
        const minBtn = me.getMinimizeButton(headerElement);
        const maxBtn = me.getMaximizeButton(headerElement);
        const popoutBtn = me.getPopoutButton(headerElement);

        const displayStyle = isTabMode ? 'none' : '';

        if (isTabMode) {
            headerElement.classList.add('window-header--tab');
        } else {
            headerElement.classList.remove('window-header--tab');
        }

        if (pinBtn) me.updateStyles(pinBtn, { display: displayStyle });
        if (minBtn) me.updateStyles(minBtn, { display: displayStyle });
        if (maxBtn) me.updateStyles(maxBtn, { display: displayStyle });
        if (popoutBtn) me.updateStyles(popoutBtn, { display: displayStyle });
    }

    /**
     * Updates the visual state for Popout Mode.
     * Hides window management controls (Min, Max, Pin, Close) as the native window handles them.
     * Changes the Popout button icon to indicate "Return".
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} isPopout - True if in popout mode.
     * @returns {void}
     */
    setPopoutMode(headerElement, isPopout) {
        const me = this;
        if (!(headerElement instanceof HTMLElement)) return;

        const popoutBtn = me.getPopoutButton(headerElement);
        const pinBtn = me.getPinButton(headerElement);
        const minBtn = me.getMinimizeButton(headerElement);
        const maxBtn = me.getMaximizeButton(headerElement);
        const closeBtn = me.getCloseButton(headerElement);

        if (popoutBtn) {
            if (isPopout) {
                popoutBtn.innerHTML = '&#8601;';
                popoutBtn.setAttribute('aria-label', 'Return to Workspace');
                popoutBtn.title = 'Return to Workspace';
            } else {
                popoutBtn.innerHTML = '↗';
                popoutBtn.setAttribute('aria-label', 'Popout Window');
                popoutBtn.title = 'Popout Window';
            }
        }

        const visibility = isPopout ? 'none' : '';

        if (pinBtn) me.updateStyles(pinBtn, { display: visibility });
        if (minBtn) me.updateStyles(minBtn, { display: visibility });
        if (maxBtn) me.updateStyles(maxBtn, { display: visibility });
        if (closeBtn) me.updateStyles(closeBtn, { display: visibility });
    }

    /**
     * Updates the visual state of the Pin button.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @param {boolean} isPinned - Whether the window is pinned.
     * @returns {void}
     */
    setPinState(headerElement, isPinned) {
        if (!(headerElement instanceof HTMLElement)) return;
        const btn = this.getPinButton(headerElement);
        if (btn) {
            if (isPinned) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }

    /**
     * Retrieves the Close button element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The button element.
     */
    getCloseButton(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.window-header__btn--close');
    }

    /**
     * Retrieves the Maximize button element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The button element.
     */
    getMaximizeButton(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.window-header__btn--maximize');
    }

    /**
     * Retrieves the Minimize button element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The button element.
     */
    getMinimizeButton(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.window-header__btn--minimize');
    }

    /**
     * Retrieves the Pin button element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The button element.
     */
    getPinButton(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.window-header__btn--pin');
    }

    /**
     * Retrieves the Popout button element.
     *
     * @param {HTMLElement} headerElement - The root header element.
     * @returns {HTMLElement|null} The button element.
     */
    getPopoutButton(headerElement) {
        if (!headerElement) return null;
        return headerElement.querySelector('.window-header__btn--popout');
    }

    /**
     * Helper to create a standardized control button.
     *
     * @param {string} action - The action identifier (class suffix).
     * @param {string} label - The visible text/icon.
     * @param {string} ariaLabel - The accessibility label.
     * @returns {HTMLButtonElement} The created button.
     * @private
     */
    _createButton(action, label, ariaLabel) {
        const me = this;
        const button = me.createElement('button', {
            className: `window-header__btn window-header__btn--${action}`,
            type: 'button',
            title: ariaLabel
        });
        button.innerHTML = label;
        button.setAttribute('aria-label', ariaLabel);

        me.on(button, 'pointerdown', event => event.stopPropagation());

        return button;
    }
}
