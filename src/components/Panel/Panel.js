// src/components/Panel/Panel.js (Modificado)

import { PanelHeader } from './PanelHeader.js';
import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';
import { globalState } from '../../services/GlobalStateService.js';

/**
 * Description:
 * The base class for a content Panel.
 * This class is an abstract controller and not a direct DOM element.
 * It manages its two child UI components:
 * 1. this._state.header (PanelHeader instance - the "tab" or "header")
 * 2. this._contentElement (HTMLElement - the "content area")
 *
 * The parent PanelGroup is responsible for orchestrating *where* these
 * two elements are attached in the final DOM.
 *
 * This class now implements a reactive lifecycle, automatically
 * subscribing/unsubscribing to keys from the GlobalStateService
 * via the 'mount' and 'unmount' hooks.
 *
 * Properties summary:
 * - _state {object} : Manages child components and configuration.
 * - id {string} : A unique ID for this panel instance.
 * - _contentElement {HTMLElement} : The DOM element for the panel's content.
 *
 * Typical usage:
 * // This is an abstract class; typically you would extend it.
 * class MyPanel extends Panel {
 *
 * render() {
 * // Called once on init
 * this.contentElement.innerHTML = 'Hello World';
 * this._myCallback = this._myCallback.bind(this);
 * }
 *
 * getObservedStateKeys() {
 * // Define which keys to listen to
 * return ['activeTool'];
 * }
 *
 * onStateUpdate(key, value) {
 * // Called when 'activeTool' changes
 * if (key === 'activeTool') {
 * this.contentElement.textContent = `Tool is: ${value}`;
 * }
 * }
 * }
 *
 * Events:
 * - Emits: 'panel:group-child-close-request' (via 'close()' method)
 *
 * Dependencies:
 * - ./PanelHeader.js
 * - ../../utils/EventBus.js
 * - ../../utils/generateId.js
 * - ../../services/GlobalStateService.js
 */
export class Panel {
    /**
     * Internal state for the Panel.
     * @type {{
     * parentGroup: import('./PanelGroup.js').PanelGroup | null,
     * header: PanelHeader | null,
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
        height: null,
        minHeight: 100,
        closable: true,
        collapsible: true,
        movable: true,
        hasTitle: true,
        title: null
    };

    /**
     * The DOM element for this panel's content.
     * @type {HTMLElement}
     * @private
     */
    _contentElement = null;

    /**
     * Stores the bound reference to the onStateUpdate function
     * for automatic unsubscribing.
     * @type {Function | null}
     * @private
     */
    _boundOnStateUpdate = null;

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

        me._contentElement = document.createElement('div');
        me._contentElement.classList.add('panel__content');

        const panelTitle = title !== undefined && title !== null ? String(title) : '';
        me._state.hasTitle = panelTitle.length > 0;
        me._state.title = panelTitle;

        me._state.header = new PanelHeader(me, panelTitle);

        if (height !== null) {
            me._state.height = height;
        }

        me.build();
        me.render();
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
     * <contentElement> getter.
     * @returns {HTMLElement} The panel's content DOM element.
     */
    get contentElement() {
        return this._contentElement;
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
     * Cleans up child components and internal listeners.
     * @returns {void}
     */
    destroy() {
        const me = this;
        me.unmount();
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
        this.contentElement.innerHTML = htmlString;
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
    }

    /**
     * Applies height and min-height styles to the content element.
     * @returns {void}
     */
    updateHeight() {
        const me = this;
        const contentEl = me.contentElement;
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
     * Initial render method. Subclasses should override this
     * to populate the panel's content element.
     * @returns {void}
     */
    render() {
        // This is intentionally left empty. Subclasses can override.
    }

    /**
     * (Lifecycle Hook) Called by PanelGroup when this panel becomes visible (active tab).
     * Subscribes to all keys specified in 'getObservedStateKeys'.
     * @returns {void}
     */
    mount() {
        const me = this;
        me._boundOnStateUpdate = me.onStateUpdate.bind(me);

        me.getObservedStateKeys().forEach(key => {
            globalState.subscribe(key, value => {
                me._boundOnStateUpdate(key, value);
            });
        });
    }

    /**
     * (Lifecycle Hook) Called by PanelGroup when this panel becomes hidden
     * (another tab selected) or before it is destroyed.
     * Unsubscribes from all observed keys.
     * @returns {void}
     */
    unmount() {
        const me = this;
        if (me._boundOnStateUpdate) {
            me.getObservedStateKeys().forEach(key => {
                globalState.unsubscribe(key, me._boundOnStateUpdate);
            });
            me._boundOnStateUpdate = null;
        }
    }

    /**
     * (Reactive Hook) Called when any observed state key (from 'getObservedStateKeys') changes.
     * @param {string} key - The state key that changed.
     * @param {*} value - The new value.
     * @returns {void}
     */
    onStateUpdate(key, value) {
        // Subclasses must implement this to react to state changes.
    }

    /**
     * (Reactive Hook) Specifies which GlobalStateService keys this panel listens to.
     * @returns {Array<string>} An array of state keys (e.g., ['activeTool', 'activeColor']).
     */
    getObservedStateKeys() {
        // Subclasses must implement this to define subscriptions.
        return [];
    }
}
