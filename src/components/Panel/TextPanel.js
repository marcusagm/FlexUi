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
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Identifies itself as 'TextPanel' to the factory.
 * - Extends toJSON() to save its 'textContent'.
 * - Extends fromJSON() to restore its 'textContent'.
 *
 * Dependencies:
 * - {import('./Panel.js').Panel}
 * - {import('../../core/IRenderer.js').IRenderer}
 *
 * Notes / Additional:
 * - Inherits visual behavior from Panel.
 */
export class TextPanel extends Panel {
    /**
     * Creates a new TextPanel instance.
     *
     * @param {string} title - The panel title.
     * @param {string} initialText - The text to display.
     * @param {number|null} [height=null] - (Ignored) Kept for API compatibility.
     * @param {object} [config={}] - Configuration overrides.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(title, initialText, height = null, config = {}, renderer = null) {
        super(title, height, config, renderer);
        const me = this;

        if (me.contentElement) {
            me.contentElement.textContent = initialText || '';
        }
    }

    /**
     * Returns the unique type identifier for this panel class.
     *
     * @returns {string} The type identifier.
     */
    static get panelType() {
        return 'TextPanel';
    }

    /**
     * Returns the instance type identifier.
     *
     * @returns {string} The type identifier string.
     */
    getPanelType() {
        return 'TextPanel';
    }

    /**
     * Serializes the Panel's state, including its text content.
     *
     * @returns {object} The serialized data.
     */
    toJSON() {
        const me = this;
        const panelData = super.toJSON();
        const newData = {
            ...panelData,
            content: me.contentElement ? me.contentElement.textContent : ''
        };
        return newData;
    }

    /**
     * Deserializes state, restoring the text content.
     *
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        super.fromJSON(data); // Restore base properties first
        if (data.content && me.contentElement) {
            me.contentElement.textContent = data.content;
        }
    }
}
