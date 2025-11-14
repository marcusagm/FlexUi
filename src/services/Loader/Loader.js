/**
 * Description:
 * A reusable component for displaying a loading overlay (spinner and message)
 * on top of a target DOM element.
 *
 * It supports two modes:
 * 1. 'fullpage': (Default) Uses position:fixed to cover the entire viewport.
 * 2. 'inset': Uses position:absolute to cover only the targetElement.
 *
 * Properties summary:
 * - _targetElement {HTMLElement} : The DOM element this Loader is attached to.
 * - _options {object} : Configuration options (e.g., type).
 * - _loaderElement {HTMLElement} : The main DOM element (.loader__overlay).
 * - _messageElement {HTMLElement} : The DOM element for the text message.
 * - _boundOnTransitionEnd {Function} : Bound listener for auto-destroy on hide.
 *
 * Typical usage:
 * // For a full-page load
 * const appLoader = new Loader(document.body, { type: 'fullpage' });
 * appLoader.show('Initializing...');
 * // ... later ...
 * appLoader.hide();
 *
 * // For an inset load
 * const panelLoader = new Loader(myPanelElement, { type: 'inset' });
 * panelLoader.show('Loading data...');
 * // ... later ...
 * panelLoader.hide();
 *
 * Dependencies:
 * - (CSS): styles/services/loader.css
 */
export class Loader {
    /**
     * The DOM element this Loader is attached to.
     * @type {HTMLElement}
     * @private
     */
    _targetElement = null;

    /**
     * Configuration options.
     * @type {{type: string}}
     * @private
     */
    _options = {
        type: 'fullpage'
    };

    /**
     * The main DOM element (.loader__overlay).
     * @type {HTMLElement | null}
     * @private
     */
    _loaderElement = null;

    /**
     * The DOM element for the text message.
     * @type {HTMLElement | null}
     * @private
     */
    _messageElement = null;

    /**
     * Bound listener for auto-destroy on hide.
     * @type {Function | null}
     * @private
     */
    _boundOnTransitionEnd = null;

    /**
     * @param {HTMLElement} targetElement - The DOM element to attach the loader to.
     * @param {object} [options={}] - Configuration options.
     * @param {string} [options.type='fullpage'] - 'fullpage' (fixed) or 'inset' (absolute).
     */
    constructor(targetElement, options = {}) {
        const me = this;
        if (!targetElement) {
            throw new Error('Loader: constructor requires a valid targetElement.');
        }

        me._targetElement = targetElement;
        me._options = Object.assign(me._options, options);

        me._boundOnTransitionEnd = me.destroy.bind(me);

        me._buildDOM();
    }

    /**
     * Creates the loader's DOM elements.
     * @private
     * @returns {void}
     */
    _buildDOM() {
        const me = this;
        me._loaderElement = document.createElement('div');
        me._loaderElement.className = 'loader__overlay';

        if (me._options.type === 'inset') {
            me._loaderElement.classList.add('loader--inset');
        } else {
            me._loaderElement.classList.add('loader--fullpage');
        }

        const spinner = document.createElement('div');
        spinner.className = 'loader__spinner';

        me._messageElement = document.createElement('div');
        me._messageElement.className = 'loader__message';

        me._loaderElement.append(spinner, me._messageElement);
    }

    /**
     * Shows the loader overlay.
     * @param {string} [message=''] - The message to display.
     * @returns {void}
     */
    show(message = '') {
        const me = this;
        if (!me._loaderElement) {
            return;
        }

        if (me._options.type === 'inset') {
            me._targetElement.classList.add('is-loading-target');
        }

        me._messageElement.textContent = message;

        if (!me._targetElement.contains(me._loaderElement)) {
            me._targetElement.appendChild(me._loaderElement);
        }

        requestAnimationFrame(() => {
            me._loaderElement.classList.add('is-visible');
        });
    }

    /**
     * Hides the loader overlay and triggers automatic cleanup.
     * @returns {void}
     */
    hide() {
        const me = this;
        if (!me._loaderElement) {
            return;
        }

        me._loaderElement.removeEventListener('transitionend', me._boundOnTransitionEnd);
        me._loaderElement.addEventListener('transitionend', me._boundOnTransitionEnd, {
            once: true
        });

        me._loaderElement.classList.remove('is-visible');
    }

    /**
     * Destroys and cleans up the loader DOM elements.
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._loaderElement) {
            me._loaderElement.removeEventListener('transitionend', me._boundOnTransitionEnd);
            me._loaderElement.remove();
        }

        if (me._options.type === 'inset') {
            me._targetElement.classList.remove('is-loading-target');
        }

        me._loaderElement = null;
        me._messageElement = null;
        me._targetElement = null;
    }
}
