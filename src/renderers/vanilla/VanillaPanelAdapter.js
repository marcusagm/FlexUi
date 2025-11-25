import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering Panel content in a Vanilla JS environment.
 * It extends the generic VanillaRenderer to provide specific methods for creating
 * and updating the DOM structure of a panel's content area. This encapsulates
 * the visual implementation details, keeping the controller (Panel) agnostic.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaPanelAdapter();
 * const contentElement = adapter.createContentElement('my-panel-id');
 * adapter.updateContent(contentElement, '<h1>Hello</h1>');
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces specific CSS classes for panel content (.panel__content).
 * - Handles polymorphic content input (string vs Node).
 * - Manages visibility and sizing styles safely.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 *
 * Notes / Additional:
 * - Inherits basic DOM manipulation capabilities from VanillaRenderer.
 */
export class VanillaPanelAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaPanelAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM element for the panel's content area.
     *
     * @param {string} id - The unique ID of the panel (used for debugging or attributes).
     * @returns {HTMLElement} The created content element.
     * @throws {Error} If the ID is invalid.
     */
    createContentElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaPanelAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const element = me.createElement('div', {
            className: 'panel__content',
            id: `panel-content-${id}`
        });

        // Apply base styles previously hardcoded in Panel.js
        me.updateStyles(element, {
            overflow: 'auto',
            flex: '1 1 auto',
            position: 'relative',
            height: 'auto'
        });

        return element;
    }

    /**
     * Updates the inner content of the panel element.
     *
     * @param {HTMLElement} element - The target content element.
     * @param {string|HTMLElement|Node} content - The content to inject.
     * @returns {void}
     */
    updateContent(element, content) {
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaPanelAdapter] invalid element assignment (${element}). Element must be an HTMLElement.`
            );
            return;
        }

        // Clear existing content manually or let renderer handle it via replacement
        element.innerHTML = '';

        if (typeof content === 'string') {
            // Reuse secure setter logic from VanillaRenderer via updateProps
            this.updateProps(element, { innerHTML: content });
        } else if (content instanceof Node) {
            element.appendChild(content);
        } else if (content !== null && content !== undefined) {
            console.warn(
                `[VanillaPanelAdapter] invalid content assignment (${content}). Content type not supported.`
            );
        }
    }

    /**
     * Updates the minimum size constraints of the panel element.
     *
     * @param {HTMLElement} element - The target element.
     * @param {number} minWidth - The minimum width in pixels.
     * @param {number} minHeight - The minimum height in pixels.
     * @returns {void}
     */
    updateMinSize(element, minWidth, minHeight) {
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaPanelAdapter] invalid element assignment (${element}). Element must be an HTMLElement.`
            );
            return;
        }

        const widthNum = Number(minWidth);
        const heightNum = Number(minHeight);

        if (Number.isNaN(widthNum) || widthNum < 0) {
            console.warn(
                `[VanillaPanelAdapter] invalid minWidth assignment (${minWidth}). Must be a positive number.`
            );
        } else {
            element.style.minWidth = `${widthNum}px`;
        }

        if (Number.isNaN(heightNum) || heightNum < 0) {
            console.warn(
                `[VanillaPanelAdapter] invalid minHeight assignment (${minHeight}). Must be a positive number.`
            );
        } else {
            element.style.minHeight = `${heightNum}px`;
        }
    }

    /**
     * Updates the visibility of the panel element.
     *
     * @param {HTMLElement} element - The target element.
     * @param {boolean} isVisible - True to show, false to hide.
     * @returns {void}
     */
    updateVisibility(element, isVisible) {
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaPanelAdapter] invalid element assignment (${element}). Element must be an HTMLElement.`
            );
            return;
        }

        const visible = Boolean(isVisible);
        if (visible) {
            element.style.display = '';
        } else {
            element.style.display = 'none';
        }
    }
}
