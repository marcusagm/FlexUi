import { PanelContent } from './PanelContent.js';
import { PanelHeader } from './PanelHeader.js';
import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * The base class for a content Panel.
 * This class is an abstract controller and not a direct DOM element.
 * It manages its two child UI components:
 * 1. this._state.header (PanelHeader instance - the "tab" or "header")
 * 2. this._state.content (PanelContent instance - the "content area")
 *
 * The parent PanelGroup is responsible for orchestrating *where* these
 * two elements are attached in the final DOM.
 *
 * Properties summary:
 * - _state {object} : Manages child components and configuration.
 * - id {string} : A unique ID for this panel instance.
 *
 * Typical usage:
 * // This is an abstract class; typically you would extend it.
 * class MyPanel extends Panel {
 * populateContent() {
 * this.getContentElement().innerHTML = 'Hello World';
 * }
 * }
 *
 * Events:
 * - Emits: 'panel:group-child-close-request' (via 'close()' method)
 *
 * Dependencies:
 * - ./PanelContent.js
 * - ./PanelHeader.js
 * - ../../utils/EventBus.js
 * - ../../utils/generateId.js
 */
export class Panel {
    /**
     * Internal state for the Panel.
     * @type {{
     * parentGroup: import('./PanelGroup.js').PanelGroup | null,
     * header: PanelHeader | null,
     * content: PanelContent | null,
     * height: number | null,
     * minHeight: number,
     * closable: boolean,
     * collapsible: boolean,
     * movable: boolean,
     * hasTitle: boolean,
     * title: string | null
     * }}
     * @private
     */
    _state = {
        parentGroup: null,
        header: null,
        content: null,
        height: null,
        minHeight: 100,
        closable: true,
        collapsible: true,
        movable: true,
        hasTitle: true,
        title: null
    };

    /**
     * Unique ID for the Panel, used by PanelGroup to manage tabs.
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * @param {string} title - The initial title for the panel header/tab.
     * @param {number|null} [height=null] - The preferred height.
     * @param {object} [config={}] - Configuration overrides (closable, movable, etc.).
     */
    constructor(title, height = null, config = {}) {
        const me = this;
        Object.assign(me._state, config);

        me._state.content = new PanelContent();

        const panelTitle = title !== undefined && title !== null ? String(title) : '';
        me._state.hasTitle = panelTitle.length > 0;
        me._state.title = panelTitle;

        me._state.header = new PanelHeader(me, panelTitle);

        if (height !== null) {
            me._state.height = height;
        }

        me.build();
        me.populateContent();
    }

    /**
     * <panelType> static getter.
     * Used by PanelFactory to identify this class type.
     * @returns {string}
     */
    static get panelType() {
        return 'Panel';
    }

    /**
     * <HeaderHeight> getter.
     * @returns {number} The pixel height of the header component.
     */
    get getHeaderHeight() {
        return this._state.header ? this._state.header.element.offsetHeight : 0;
    }

    /**
     * <MinPanelHeight> getter.
     * @returns {number} The minimum height for the panel's content area.
     */
    getMinPanelHeight() {
        return Math.max(0, this._state.minHeight);
    }

    /**
     * <ContentElement> getter.
     * @returns {HTMLElement} The panel's content DOM element.
     */
    getContentElement() {
        return this._state.content.element;
    }

    /**
     * <PanelType> getter.
     * @returns {string} The type identifier string.
     */
    getPanelType() {
        return 'Panel';
    }

    /**
     * <ParentGroup> setter.
     * @param {import('./PanelGroup.js').PanelGroup | null} group - The parent PanelGroup.
     * @returns {void}
     */
    setParentGroup(group) {
        const me = this;
        me._state.parentGroup = group;
        if (me._state.header) {
            me._state.header.setParentGroup(group);
        }
    }

    /**
     * Cleans up child components.
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._state.header && typeof me._state.header.destroy === 'function') {
            me._state.header.destroy();
        }
    }

    /**
     * Builds the panel's internal structure.
     * @returns {void}
     */
    build() {
        this.updateHeight();
    }

    /**
     * Sets the inner HTML of the content element.
     * @param {string} htmlString - The HTML string to set.
     * @returns {void}
     */
    setContent(htmlString) {
        this.getContentElement().innerHTML = htmlString;
    }

    /**
     * Requests to be closed by its parent group.
     * @returns {void}
     */
    close() {
        const me = this;
        if (!me._state.closable) return;

        if (me._state.parentGroup) {
            appBus.emit('panel:group-child-close-request', {
                panel: me,
                group: me._state.parentGroup
            });
        }

        me.destroy();
    }

    /**
     * Applies height and min-height styles to the content element.
     * @returns {void}
     */
    updateHeight() {
        const me = this;
        const contentEl = me.getContentElement();
        if (!contentEl) return;

        contentEl.style.minHeight = `${me.getMinPanelHeight()}px`;
        contentEl.style.height = 'auto';
        contentEl.style.flex = '1 1 auto';
    }

    /**
     * Serializes the Panel's state to a JSON-friendly object.
     * @returns {object}
     */
    toJSON() {
        const me = this;
        return {
            id: me.id,
            type: me.getPanelType(),
            title: me._state.title,
            height: me._state.height,
            config: {
                closable: me._state.closable,
                collapsible: me._state.collapsible,
                movable: me._state.movable,
                minHeight: me._state.minHeight
            }
        };
    }

    /**
     * Deserializes state from a JSON object.
     * @param {object} data - The state object.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        if (data.id) {
            me.id = data.id;
        }
        if (data.height !== undefined) {
            me._state.height = data.height;
        }
        if (data.title !== undefined) {
            me._state.title = data.title;
            if (me._state.header) {
                me._state.header.setTitle(data.title);
            }
        }

        if (data.config) {
            Object.assign(me._state, data.config);
            if (me._state.header) {
                me._state.header.updateConfig(data.config);
            }
        }
    }

    /**
     * Abstract method. Subclasses must implement this to populate
     * the panel's content element.
     * @abstract
     * @returns {void}
     * @throws {Error}
     */
    populateContent() {
        throw new Error(
            'Panel.populateContent() is abstract and must be implemented by a subclass.'
        );
    }
}
