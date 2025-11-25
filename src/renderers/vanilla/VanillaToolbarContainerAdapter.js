import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering ToolbarContainer components in a Vanilla JS environment.
 * It encapsulates the DOM structure for the toolbar shell, handling styling related to
 * position, orientation, and empty states.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaToolbarContainerAdapter();
 * const containerEl = adapter.createContainerElement('main-toolbar');
 * adapter.updateConfiguration(containerEl, 'top', 'horizontal');
 * adapter.setEmptyState(containerEl, false);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces .toolbar-container CSS class structure.
 * - Manages modifiers for position (top/bottom/left/right) and orientation (horizontal/vertical).
 * - Handles visibility state when the toolbar has no items.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaToolbarContainerAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaToolbarContainerAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM element for the Toolbar Container.
     *
     * @param {string} id - The unique ID of the toolbar.
     * @returns {HTMLElement} The root toolbar element.
     * @throws {Error} If the ID is invalid.
     */
    createContainerElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaToolbarContainerAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const element = me.createElement('div', {
            className: 'toolbar-container',
            id: `toolbar-${id}`
        });

        element.setAttribute('role', 'toolbar');

        return element;
    }

    /**
     * Updates the position and orientation classes of the toolbar.
     * Cleans up previous modifier classes before applying new ones.
     *
     * @param {HTMLElement} element - The toolbar element.
     * @param {string} position - 'top', 'bottom', 'left', 'right'.
     * @param {string} orientation - 'horizontal', 'vertical'.
     * @returns {void}
     */
    updateConfiguration(element, position, orientation) {
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaToolbarContainerAdapter] Invalid element provided to updateConfiguration.`
            );
            return;
        }

        // List of all possible modifier classes to remove
        const positions = ['top', 'bottom', 'left', 'right'];
        const orientations = ['horizontal', 'vertical'];

        positions.forEach(pos => element.classList.remove(`toolbar-container--${pos}`));
        orientations.forEach(ori => element.classList.remove(`toolbar-container--${ori}`));

        // Apply new classes
        if (positions.includes(position)) {
            element.classList.add(`toolbar-container--${position}`);
        } else {
            console.warn(`[VanillaToolbarContainerAdapter] Invalid position: ${position}`);
        }

        if (orientations.includes(orientation)) {
            element.classList.add(`toolbar-container--${orientation}`);
        } else {
            console.warn(`[VanillaToolbarContainerAdapter] Invalid orientation: ${orientation}`);
        }

        // Update ARIA
        element.setAttribute('aria-orientation', orientation);
        element.setAttribute('aria-label', `${position} toolbar`);
    }

    /**
     * Toggles the empty state visual class.
     *
     * @param {HTMLElement} element - The toolbar element.
     * @param {boolean} isEmpty - True if the toolbar has no items.
     * @returns {void}
     */
    setEmptyState(element, isEmpty) {
        if (!(element instanceof HTMLElement)) return;

        if (isEmpty) {
            element.classList.add('is-empty');
        } else {
            element.classList.remove('is-empty');
        }
    }

    /**
     * Retrieves the container element where the strip/items should be mounted.
     * In this implementation, it returns the root element itself.
     *
     * @param {HTMLElement} element - The root toolbar element.
     * @returns {HTMLElement} The container for items.
     */
    getStripContainer(element) {
        return element;
    }
}
