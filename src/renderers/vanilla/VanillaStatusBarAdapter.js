import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering the StatusBar component in a Vanilla JS environment.
 * It encapsulates the creation of the status bar structure and provides methods
 * to safely update the permanent and temporary message areas.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaStatusBarAdapter();
 * const barElement = adapter.createStatusBarElement('main-status');
 * adapter.updatePermanentMessage(barElement, 'Ready');
 * adapter.updateTemporaryMessage(barElement, 'File saved');
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces .status-bar CSS class structure.
 * - Separates permanent status (left/default) from temporary feedback (overlay or adjacent).
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaStatusBarAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaStatusBarAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM structure for the StatusBar.
     * Structure:
     * <div class="status-bar">
     * <span class="status-bar__permanent"></span>
     * <span class="status-bar__temporary"></span>
     * </div>
     *
     * @param {string} id - The unique ID of the status bar.
     * @returns {HTMLElement} The root status bar element.
     * @throws {Error} If the ID is invalid.
     */
    createStatusBarElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaStatusBarAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const element = me.createElement('div', {
            className: 'status-bar',
            id: `status-bar-${id}`
        });

        const permanentMsg = me.createElement('span', {
            className: 'status-bar__permanent'
        });

        const temporaryMsg = me.createElement('span', {
            className: 'status-bar__temporary'
        });

        me.mount(element, permanentMsg);
        me.mount(element, temporaryMsg);

        return element;
    }

    /**
     * Updates the text content of the permanent message area.
     *
     * @param {HTMLElement} element - The root status bar element.
     * @param {string} text - The message text to display.
     * @returns {void}
     */
    updatePermanentMessage(element, text) {
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaStatusBarAdapter] Invalid element provided to updatePermanentMessage.`
            );
            return;
        }

        const target = element.querySelector('.status-bar__permanent');
        if (target) {
            target.textContent = text || '';
        }
    }

    /**
     * Updates the text content of the temporary message area.
     *
     * @param {HTMLElement} element - The root status bar element.
     * @param {string} text - The message text to display.
     * @returns {void}
     */
    updateTemporaryMessage(element, text) {
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaStatusBarAdapter] Invalid element provided to updateTemporaryMessage.`
            );
            return;
        }

        const target = element.querySelector('.status-bar__temporary');
        if (target) {
            target.textContent = text || '';
        }
    }
}
