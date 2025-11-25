import { UIElement } from '../../core/UIElement.js';

/**
 * Description:
 * Abstract base class defining the public contract for all Panel components.
 * It serves as an interface to ensure consistency across different panel implementations
 * (e.g., text panels, chart panels, toolbars), regardless of the rendering technology.
 *
 * Properties summary:
 * - (Inherits from UIElement)
 *
 * Typical usage:
 * // In a concrete implementation:
 * class MyPanel extends IPanel {
 * setTitle(title) { ... }
 * // ... implementation
 * }
 *
 * Events:
 * - (Inherits from UIElement)
 *
 * Business rules implemented:
 * - Enforces implementation of core panel operations (title, content, layout constraints).
 * - Prevents direct instantiation of the abstract interface.
 * - Inherits lifecycle and event system from UIElement.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 */
export class IPanel extends UIElement {
    /**
     * Creates an instance of IPanel.
     * Prevents direct instantiation of the abstract class.
     *
     * @param {string} [id=null] - Optional unique ID.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional custom renderer.
     */
    constructor(id = null, renderer = null) {
        super(id, renderer);
        if (this.constructor === IPanel) {
            throw new Error('Abstract class IPanel cannot be instantiated directly.');
        }
    }

    /**
     * Sets the title displayed in the panel header or tab.
     *
     * @param {string} title - The new title text.
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */
    setTitle(title) {
        throw new Error("Method 'setTitle(title)' must be implemented by subclasses of IPanel.");
    }

    /**
     * Retrieves the current title of the panel.
     *
     * @returns {string} The current title.
     * @throws {Error} If not implemented by subclass.
     */
    getTitle() {
        throw new Error("Method 'getTitle()' must be implemented by subclasses of IPanel.");
    }

    /**
     * Sets the content of the panel body.
     *
     * @param {string|HTMLElement|object} content - The content to display.
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */
    setContent(content) {
        throw new Error(
            "Method 'setContent(content)' must be implemented by subclasses of IPanel."
        );
    }

    /**
     * Requests the panel to close itself.
     *
     * @returns {void}
     * @throws {Error} If not implemented by subclass.
     */
    close() {
        throw new Error("Method 'close()' must be implemented by subclasses of IPanel.");
    }

    /**
     * Retrieves the minimum height required by this panel.
     *
     * @returns {number} The minimum height in pixels.
     * @throws {Error} If not implemented by subclass.
     */
    getMinHeight() {
        throw new Error("Method 'getMinHeight()' must be implemented by subclasses of IPanel.");
    }

    /**
     * Retrieves the minimum width required by this panel.
     *
     * @returns {number} The minimum width in pixels.
     * @throws {Error} If not implemented by subclass.
     */
    getMinWidth() {
        throw new Error("Method 'getMinWidth()' must be implemented by subclasses of IPanel.");
    }
}
