import { IRenderer } from '../../core/IRenderer.js';

/**
 * Description:
 * Concrete implementation of the IRenderer interface for standard web browser environments.
 * This class handles direct DOM manipulation, providing a unified API for creating,
 * updating, and managing HTML elements. It serves as the default rendering engine
 * for the framework when no specific framework adapter (e.g., React, Vue) is used.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const renderer = new VanillaRenderer();
 * const div = renderer.createElement('div', { className: 'container' });
 * renderer.mount(document.body, div);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Validates all DOM operations before execution to prevent runtime errors.
 * - Sanitizes 'innerHTML' assignments to prevent basic XSS (warns and blocks javascript: protocols).
 * - Handles differentiation between attributes (e.g., 'class', 'id') and properties (e.g., 'value', 'checked').
 * - Manages event listener attachment and detachment securely.
 *
 * Dependencies:
 * - {import('../../core/IRenderer.js').IRenderer}
 *
 * Notes / Additional:
 * - This class is stateless.
 */
export class VanillaRenderer extends IRenderer {
    /**
     * Description:
     * Creates an instance of VanillaRenderer.
     */
    constructor() {
        super();
    }

    /**
     * Creates a new DOM element with the specified tag, properties, and children.
     *
     * @param {string} tagName - The HTML tag name (e.g., 'div', 'button').
     * @param {object} [properties={}] - An object of attributes and properties to apply.
     * @param {Array<HTMLElement|string>} [children=[]] - An array of child nodes or strings.
     * @returns {HTMLElement} The created DOM element.
     * @throws {Error} If tagName is invalid.
     */
    createElement(tagName, properties = {}, children = []) {
        const me = this;
        if (typeof tagName !== 'string' || tagName.trim() === '') {
            throw new Error(
                `[VanillaRenderer] Invalid tagName: "${tagName}". Must be a non-empty string.`
            );
        }

        const element = document.createElement(tagName);

        if (properties && typeof properties === 'object') {
            me.updateProps(element, properties);
        }

        if (Array.isArray(children)) {
            children.forEach(child => {
                if (typeof child === 'string' || typeof child === 'number') {
                    element.appendChild(document.createTextNode(String(child)));
                } else if (child instanceof Node) {
                    element.appendChild(child);
                } else {
                    console.warn(
                        `[VanillaRenderer] Invalid child skipped during creation: ${child}`
                    );
                }
            });
        }

        return element;
    }

    /**
     * Mounts (appends) a child element to a target parent container.
     *
     * @param {HTMLElement} target - The parent container element.
     * @param {HTMLElement} element - The element to be mounted.
     * @returns {void}
     * @throws {Error} If target or element are invalid DOM nodes.
     */
    mount(target, element) {
        if (!(target instanceof Node)) {
            throw new Error('[VanillaRenderer] Mount target must be a valid DOM Node.');
        }
        if (!(element instanceof Node)) {
            throw new Error('[VanillaRenderer] Element to mount must be a valid DOM Node.');
        }

        target.appendChild(element);
    }

    /**
     * Unmounts (removes) a child element from a target parent container.
     *
     * @param {HTMLElement} target - The parent container element.
     * @param {HTMLElement} element - The element to be removed.
     * @returns {void}
     */
    unmount(target, element) {
        if (!(target instanceof Node) || !(element instanceof Node)) {
            console.warn('[VanillaRenderer] Cannot unmount: Invalid target or element.');
            return;
        }

        if (target.contains(element)) {
            target.removeChild(element);
        }
    }

    /**
     * Updates the attributes and properties of a DOM element.
     * Handles special cases like 'className', 'style', and 'dataset'.
     *
     * @param {HTMLElement} element - The target DOM element.
     * @param {object} properties - The object containing properties to update.
     * @returns {void}
     */
    updateProps(element, properties) {
        const me = this;
        if (!(element instanceof HTMLElement) || !properties) {
            return;
        }

        Object.keys(properties).forEach(key => {
            const value = properties[key];

            if (key === 'style') {
                me.updateStyles(element, value);
                return;
            }

            if (key === 'className' || key === 'class') {
                element.className = String(value);
                return;
            }

            if (key === 'dataset' && typeof value === 'object') {
                Object.assign(element.dataset, value);
                return;
            }

            if (key === 'innerHTML') {
                me._setInnerHTMLSecurely(element, value);
                return;
            }

            if (key.startsWith('on') && typeof value === 'function') {
                const eventName = key.substring(2).toLowerCase();
                element.addEventListener(eventName, value);
                return;
            }

            if (value === null || value === undefined || value === false) {
                element.removeAttribute(key);
            } else if (value === true) {
                element.setAttribute(key, '');
            } else {
                // Try setting as property first (for inputs), then attribute
                if (key in element) {
                    try {
                        element[key] = value;
                    } catch (err) {
                        console.warn(
                            `[VanillaRenderer] Failed to set property "${key}", falling back to attribute. Error:`,
                            err
                        );
                        element.setAttribute(key, String(value));
                    }
                } else {
                    element.setAttribute(key, String(value));
                }
            }
        });
    }

    /**
     * Updates the inline CSS styles of an element.
     *
     * @param {HTMLElement} element - The target DOM element.
     * @param {object} styles - An object mapping CSS properties to values.
     * @returns {void}
     */
    updateStyles(element, styles) {
        if (!(element instanceof HTMLElement) || typeof styles !== 'object' || styles === null) {
            return;
        }

        Object.keys(styles).forEach(styleKey => {
            const styleValue = styles[styleKey];
            if (styleValue === null || styleValue === undefined) {
                element.style.removeProperty(styleKey);
            } else {
                if (styleKey.startsWith('--')) {
                    element.style.setProperty(styleKey, String(styleValue));
                } else {
                    element.style[styleKey] = String(styleValue);
                }
            }
        });
    }

    /**
     * Adds an event listener to an element.
     *
     * @param {HTMLElement} element - The target element.
     * @param {string} eventName - The name of the event (e.g., 'click').
     * @param {Function} handler - The callback function.
     * @param {object|boolean} [options=false] - Options for addEventListener.
     * @returns {void}
     */
    on(element, eventName, handler, options = false) {
        if (element && typeof element.addEventListener === 'function') {
            element.addEventListener(eventName, handler, options);
        }
    }

    /**
     * Removes an event listener from an element.
     *
     * @param {HTMLElement} element - The target element.
     * @param {string} eventName - The name of the event.
     * @param {Function} handler - The callback function to remove.
     * @param {object|boolean} [options=false] - Options for removeEventListener.
     * @returns {void}
     */
    off(element, eventName, handler, options = false) {
        if (element && typeof element.removeEventListener === 'function') {
            element.removeEventListener(eventName, handler, options);
        }
    }

    /**
     * Retrieves the bounding client rectangle of an element.
     *
     * @param {HTMLElement} element - The target element.
     * @returns {DOMRect} The size and position of the element.
     */
    getDimensions(element) {
        if (element && typeof element.getBoundingClientRect === 'function') {
            return element.getBoundingClientRect();
        }
        return new DOMRect(0, 0, 0, 0);
    }

    /**
     * Gets the underlying DOM element.
     * For VanillaRenderer, the element passed IS the DOM element, so it returns itself.
     *
     * @param {HTMLElement} element - The element wrapper.
     * @returns {HTMLElement} The raw DOM element.
     */
    getElement(element) {
        return element;
    }

    /**
     * Destroys an element (removes it from DOM).
     *
     * @param {HTMLElement} element - The element to destroy.
     * @returns {void}
     */
    destroy(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    /**
     * Sets innerHTML with basic validation to prevent obvious script injections.
     *
     * @param {HTMLElement} element - The target element.
     * @param {string} htmlContent - The HTML string.
     * @private
     * @returns {void}
     */
    _setInnerHTMLSecurely(element, htmlContent) {
        const contentString = String(htmlContent);

        // Basic check for script tags

        if (/<script\b[^>]*>([\s\S]*?)<\/script>/gim.test(contentString)) {
            console.warn(
                '[VanillaRenderer] Security Warning: Attempted to set innerHTML with <script> tags. Operation blocked.'
            );
            return;
        }

        // Basic check for javascript: protocol in attributes
        if (/javascript:/gim.test(contentString)) {
            console.warn(
                '[VanillaRenderer] Security Warning: Attempted to set innerHTML with "javascript:" protocol. Operation blocked.'
            );
            return;
        }

        element.innerHTML = contentString;
    }
}
