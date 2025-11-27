import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering the Loader component.
 * Encapsulates the DOM structure creation for the loading overlay,
 * spinner, and message text.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaLoaderAdapter();
 * const loaderEl = adapter.createLoaderElement('loader-1', 'fullpage');
 * adapter.updateMessage(loaderEl, 'Loading...');
 * adapter.setVisible(loaderEl, true);
 *
 * Events:
 * - None
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaLoaderAdapter extends VanillaRenderer {
    constructor() {
        super();
    }

    /**
     * Creates the root loader element with the necessary structure.
     *
     * @param {string} id - Unique ID.
     * @param {string} type - 'fullpage' or 'inset'.
     * @returns {HTMLElement} The root element.
     */
    createLoaderElement(id, type) {
        const me = this;
        const element = me.createElement('div', {
            className: 'loader__overlay',
            id: `loader-${id}`
        });

        if (type === 'inset') {
            element.classList.add('loader--inset');
        } else {
            element.classList.add('loader--fullpage');
        }

        const spinner = me.createElement('div', {
            className: 'loader__spinner'
        });

        const message = me.createElement('div', {
            className: 'loader__message'
        });

        me.mount(element, spinner);
        me.mount(element, message);

        return element;
    }

    /**
     * Updates the message text.
     *
     * @param {HTMLElement} element - The loader root element.
     * @param {string} text - The message to display.
     */
    updateMessage(element, text) {
        if (!element) return;
        const msgEl = element.querySelector('.loader__message');
        if (msgEl) {
            msgEl.textContent = text || '';
        }
    }

    /**
     * Toggles the visibility class.
     *
     * @param {HTMLElement} element - The loader root element.
     * @param {boolean} visible - True to show.
     */
    setVisible(element, visible) {
        if (!element) return;
        if (visible) {
            element.classList.add('is-visible');
        } else {
            element.classList.remove('is-visible');
        }
    }

    /**
     * Sets a class on the target container to handle positioning context (inset mode).
     *
     * @param {HTMLElement} targetElement - The container element.
     * @param {boolean} active - True to add class, false to remove.
     */
    setTargetClass(targetElement, active) {
        if (!targetElement) return;
        if (active) {
            targetElement.classList.add('is-loading-target');
        } else {
            targetElement.classList.remove('is-loading-target');
        }
    }
}
