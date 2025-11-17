import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * The abstract base class for a "Toolbar Group".
 * A ToolbarGroup is a self-contained, draggable UI component that lives
 * inside a ToolbarContainer. Subclasses (like ApplicationGroup)
 * must implement the 'render' method to populate the content.
 *
 * Properties summary:
 * - _state {object} : Manages parent container, title, and configuration.
 * - id {string} : A unique ID for this group instance.
 * - element {HTMLElement} : The main DOM element (.toolbar-group).
 * - _dragHandle {HTMLElement} : The DOM element for the drag handle.
 * - _titleEl {HTMLElement} : The DOM element for the title (if provided).
 * - _contentElement {HTMLElement} : The DOM wrapper for group content.
 *
 * Typical usage:
 * // class MyToolbarGroup extends ToolbarGroup {
 * //   static get toolbarGroupType() { return 'MyGroup'; }
 * //   render() { this.contentElement.innerHTML = '<button>My Button</button>'; }
 * // }
 *
 * Events:
 * - Emits (appBus): 'dragstart', 'dragend'
 *
 * Dependencies:
 * - ../../utils/EventBus.js
 * - ../../utils/generateId.js
 */
export class ToolbarGroup {
    /**
     * @type {{
     * parentContainer: import('./ToolbarContainer.js').ToolbarContainer | null,
     * title: string | null,
     * movable: boolean
     * }}
     * @private
     */
    _state = {
        parentContainer: null,
        title: null,
        movable: true
    };

    /**
     * The main DOM element (.toolbar-group).
     * @type {HTMLElement | null}
     * @public
     */
    element = null;

    /**
     * The DOM element for the drag handle.
     * @type {HTMLElement | null}
     * @private
     */
    _dragHandle = null;

    /**
     * The DOM element for the title (if provided).
     * @type {HTMLElement | null}
     * @private
     */
    _titleEl = null;

    /**
     * The DOM wrapper for group content.
     * @type {HTMLElement | null}
     * @private
     */
    _contentElement = null;

    /**
     * Unique ID for the ToolbarGroup.
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnDragStart = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnDragEnd = null;

    /**
     * @param {string} [title=''] - The title for the group.
     * @param {object} [config={}] - Configuration overrides (e.g., movable).
     */
    constructor(title = '', config = {}) {
        const me = this;
        Object.assign(me._state, config);
        me._state.title = title;

        me._boundOnDragStart = me.onDragStart.bind(me);
        me._boundOnDragEnd = me.onDragEnd.bind(me);

        me._buildDOM();
        me._initEventListeners();
    }

    /**
     * <toolbarGroupType> static getter.
     * Used by ToolbarGroupFactory. Subclasses MUST override this.
     * @returns {string}
     * @abstract
     */
    static get toolbarGroupType() {
        throw new Error('ToolbarGroup: Subclass must override static get toolbarGroupType()');
    }

    /**
     * <contentElement> getter.
     * @returns {HTMLElement} The panel's content DOM element.
     */
    get contentElement() {
        return this._contentElement;
    }

    /**
     * <ParentContainer> setter.
     * @param {import('./ToolbarContainer.js').ToolbarContainer | null} container
     * @returns {void}
     */
    setParentContainer(container) {
        this._state.parentContainer = container;
    }

    /**
     * Builds the component's DOM structure.
     * @private
     * @returns {void}
     */
    _buildDOM() {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('toolbar-group');

        me._dragHandle = document.createElement('div');
        me._dragHandle.className = 'toolbar-group__handle';
        me._dragHandle.draggable = true;
        const icon = document.createElement('span');
        icon.className = 'icon icon-handle';
        me._dragHandle.appendChild(icon);
        me.element.appendChild(me._dragHandle);

        if (me._state.title) {
            me._titleEl = document.createElement('span');
            me._titleEl.className = 'toolbar-group__title';
            me._titleEl.textContent = me._state.title;
            me.element.appendChild(me._titleEl);
        }

        me._contentElement = document.createElement('div');
        me._contentElement.className = 'toolbar-group__content';
        me.element.appendChild(me._contentElement);

        if (!me._state.movable) {
            me._dragHandle.style.display = 'none';
        }
    }

    /**
     * Attaches DND event listeners to the drag handle.
     * @private
     * @returns {void}
     */
    _initEventListeners() {
        const me = this;
        if (me._state.movable && me._dragHandle) {
            me._dragHandle.addEventListener('dragstart', me._boundOnDragStart);
            me._dragHandle.addEventListener('dragend', me._boundOnDragEnd);
        }
    }

    /**
     * Cleans up event listeners.
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._state.movable && me._dragHandle) {
            me._dragHandle.removeEventListener('dragstart', me._boundOnDragStart);
            me._dragHandle.removeEventListener('dragend', me._boundOnDragEnd);
        }
        me.element.remove();
    }

    /**
     * Handles the drag start event (drag source).
     * @param {DragEvent} e
     * @returns {void}
     */
    onDragStart(e) {
        const me = this;
        e.stopPropagation();

        if (!me._state.movable) {
            e.preventDefault();
            return;
        }

        appBus.emit('dragstart', {
            item: me,
            type: 'ToolbarGroup',
            element: me.element,
            event: e
        });
    }

    /**
     * Handles the drag end event.
     * @param {DragEvent} e
     * @returns {void}
     */
    onDragEnd(e) {
        e.stopPropagation();
        appBus.emit('dragend');
    }

    /**
     * Serializes the ToolbarGroup's state.
     * @returns {object}
     */
    toJSON() {
        const me = this;
        return {
            id: me.id,
            type: me.getToolbarGroupType(),
            title: me._state.title
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
        if (data.title !== undefined) {
            me._state.title = data.title;
            if (me._titleEl) {
                me._titleEl.textContent = data.title;
            }
        }
    }

    /**
     * <ToolbarGroupType> getter.
     * @returns {string} The type identifier string.
     * @abstract
     */
    getToolbarGroupType() {
        throw new Error('ToolbarGroup: Subclass must override getToolbarGroupType()');
    }

    /**
     * Initial render method. Subclasses MUST override this
     * to populate the .contentElement.
     * @returns {void}
     * @abstract
     */
    render() {
        throw new Error('ToolbarGroup: Subclass must override render()');
    }
}
