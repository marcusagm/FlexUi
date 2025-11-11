import { Panel } from './Panel.js';

/**
 * Description:
 * A concrete implementation of Panel that renders simple text content.
 *
 * Properties summary:
 * - (Inherits from Panel)
 *
 * Typical usage:
 * const textPanel = new TextPanel('My Title', 'Hello world');
 *
 * Business rules implemented:
 * - Identifies itself as 'TextPanel' to the factory.
 * - Extends toJSON() to save its 'textContent'.
 * - Extends fromJSON() to restore its 'textContent'.
 *
 * Dependencies:
 * - ./Panel.js
 */
export class TextPanel extends Panel {
    /**
     * @param {string} title - The panel title.
     * @param {string} initialText - The text to display.
     * @param {number|null} [height=null] - The initial height.
     * @param {object} [config={}] - Configuration overrides.
     */
    constructor(title, initialText, height = null, config = {}) {
        super(title, height, config);
        this.getContentElement().textContent = initialText;
    }

    /**
     * <panelType> static getter.
     * @returns {string}
     */
    static get panelType() {
        return 'TextPanel';
    }

    /**
     * (Overrides Panel) Populates the content element.
     * @returns {void}
     */
    populateContent() {
        // This is intentionally left empty because the content
        // is set in the constructor.
    }

    /**
     * <PanelType> getter.
     * @returns {string}
     */
    getPanelType() {
        return 'TextPanel';
    }

    /**
     * Serializes the Panel's state, including its text content.
     * @returns {object}
     */
    toJSON() {
        const me = this;
        const panelData = super.toJSON();
        const newData = {
            ...panelData,
            content: me.getContentElement().textContent
        };
        return newData;
    }

    /**
     * Deserializes state, restoring the text content.
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        super.fromJSON(data); // Restore base properties first
        me.getContentElement().textContent = data.content;
    }
}
