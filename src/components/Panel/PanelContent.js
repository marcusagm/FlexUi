/**
 * Description:
 * A simple wrapper class that holds the main DOM element for a
 * Panel's content (the <div class="panel__content">).
 *
 * Properties summary:
 * - element {HTMLElement} : The main DOM element.
 *
 * Typical usage:
 * // Instantiated by Panel.js
 * this._state.content = new PanelContent();
 *
 * Dependencies:
 * - None
 */
export class PanelContent {
    /**
     * The main DOM element for this content.
     * @type {HTMLElement}
     * @public
     */
    element;

    /**
     * @param {string | null} [content=null] - Optional initial HTML content.
     */
    constructor(content = null) {
        this.element = document.createElement('div');
        this.element.classList.add('panel__content');
        if (content) {
            this.element.innerHTML = content;
        }
    }
}
