/**
 * Description:
 * Abstract base class defining the contract for rendering operations.
 * This interface decouples component logic from direct DOM manipulation,
 * allowing for different rendering backends (e.g., native DOM, Virtual DOM wrappers).
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * // In a concrete implementation:
 * class DomRenderer extends IRenderer {
 * createElement(tag, props, children) { ... }
 * // ... implementation
 * }
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces implementation of core DOM operations.
 * - Ensures consistent API for element creation, mounting, and updates.
 *
 * Dependencies:
 * - None
 */
export class IRenderer {
    /**
     * Creates an instance of IRenderer.
     * Prevents direct instantiation of the abstract class.
     */
    constructor() {
        if (this.constructor === IRenderer) {
            throw new Error('Abstract class IRenderer cannot be instantiated directly.');
        }
    }

    /**
     * Creates a new visual element.
     *
     * @param {string} tag - The tag name of the element to create.
     * @param {object} [properties={}] - Initial properties and attributes.
     * @param {Array<HTMLElement|string>} [children=[]] - Initial child nodes.
     * @returns {HTMLElement} The created element.
     * @throws {Error} If not implemented by subclass.
     */
    createElement(tag, properties = {}, children = []) {
        throw new Error('Method createElement must be implemented.');
    }

    /**
     * Inserts an element into a target container.
     *
     * @param {HTMLElement} target - The container element.
     * @param {HTMLElement} element - The element to mount.
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */
    mount(target, element) {
        throw new Error('Method mount must be implemented.');
    }

    /**
     * Removes an element from a target container.
     *
     * @param {HTMLElement} target - The container element.
     * @param {HTMLElement} element - The element to unmount.
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */
    unmount(target, element) {
        throw new Error('Method unmount must be implemented.');
    }

    /**
     * Updates the attributes and properties of an element.
     *
     * @param {HTMLElement} element - The target element.
     * @param {object} properties - The key-value map of properties to update.
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */
    updateProps(element, properties) {
        throw new Error('Method updateProps must be implemented.');
    }

    /**
     * Updates the CSS styles of an element.
     *
     * @param {HTMLElement} element - The target element.
     * @param {object} styles - The key-value map of styles to apply.
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */
    updateStyles(element, styles) {
        throw new Error('Method updateStyles must be implemented.');
    }

    /**
     * Adds an event listener to an element.
     *
     * @param {HTMLElement} element - The target element.
     * @param {string} eventName - The name of the event to listen for.
     * @param {Function} handler - The callback function.
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */
    on(element, eventName, handler) {
        throw new Error('Method on must be implemented.');
    }

    /**
     * Removes an event listener from an element.
     *
     * @param {HTMLElement} element - The target element.
     * @param {string} eventName - The name of the event.
     * @param {Function} handler - The callback function to remove.
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */
    off(element, eventName, handler) {
        throw new Error('Method off must be implemented.');
    }

    /**
     * Retrieves the dimensions and position of an element.
     *
     * @param {HTMLElement} element - The target element.
     * @returns {DOMRect} The bounding client rectangle.
     * @throws {Error} If not implemented by subclass.
     */
    getDimensions(element) {
        throw new Error('Method getDimensions must be implemented.');
    }
}
