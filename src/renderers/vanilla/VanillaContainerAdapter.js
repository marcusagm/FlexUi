import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering the root Container component in a Vanilla JS environment.
 * It encapsulates the creation of the main grid container element.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaContainerAdapter();
 * const containerElement = adapter.createContainerElement('main-container');
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces .container CSS class structure.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaContainerAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaContainerAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM element for the Container.
     *
     * @param {string} id - The unique ID of the container.
     * @returns {HTMLElement} The root container element.
     * @throws {Error} If the ID is invalid.
     */
    createContainerElement(id) {
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaContainerAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const element = this.createElement('div', {
            className: 'container',
            id: `container-${id}`
        });

        return element;
    }
}
