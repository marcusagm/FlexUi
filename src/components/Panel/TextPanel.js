import { Panel } from './Panel.js';

/**
 * Description:
 * A concrete implementation of Panel that renders simple text content.
 * It standardizes the constructor signature by accepting text content via the configuration object.
 *
 * Properties summary:
 * - (Inherits from Panel)
 *
 * Typical usage:
 * const textPanel = new TextPanel('My Title', { content: 'Hello world' });
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Identifies itself as 'TextPanel' to the factory.
 * - Reads initial content from `config.content`.
 * - Persists content property in `toJSON` for serialization.
 * - Restores content property in `fromJSON`.
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
     * @param {object} [config={}] - Configuration options (including 'content').
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(title, config = {}, renderer = null) {
        super(title, config, renderer);
        const me = this;

        if (me.contentElement) {
            // Access content from config object, defaulting to empty string
            const textContent = config.content || '';
            me.contentElement.textContent = textContent;
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
        super.fromJSON(data);
        if (data.content && me.contentElement) {
            me.contentElement.textContent = data.content;
        }
    }
}
