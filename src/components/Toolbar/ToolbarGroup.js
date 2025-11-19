import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * The abstract base class for a "Toolbar Group".
 * A ToolbarGroup is a self-contained, draggable UI component.
 * Updated with A11y attributes and Synthetic Pointer Drag.
 *
 * Properties summary:
 * - id {string} : Unique identifier for the group.
 * - element {HTMLElement} : The main DOM element.
 * - parentContainer {ToolbarContainer} : The container this group belongs to.
 * - title {string} : The visual title of the group.
 * - movable {boolean} : Whether the group is draggable.
 *
 * Events:
 * - Emits: 'dragstart' (via appBus)
 *
 * Dependencies:
 * - {import('../../utils/EventBus.js').appBus}
 * - {import('../../utils/generateId.js').generateId}
 */
export class ToolbarGroup {
    /**
     * The container this group belongs to.
     *
     * @type {import('./ToolbarContainer.js').ToolbarContainer | null}
     * @private
     */
    _parentContainer = null;

    /**
     * The visual title of the group.
     *
     * @type {string | null}
     * @private
     */
    _title = null;

    /**
     * Whether the group handles dragging.
     *
     * @type {boolean}
     * @private
     */
    _movable = true;

    /**
     * The main DOM element.
     *
     * @type {HTMLElement | null}
     * @public
     */
    element = null;

    /**
     * The DOM element for the drag handle.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _dragHandle = null;

    /**
     * The DOM element for the title text.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _titleEl = null;

    /**
     * The container for the content.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _contentElement = null;

    /**
     * Unique identifier.
     *
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * Bound pointer down handler.
     *
     * @type {Function | null}
     * @private
     */
    _boundOnPointerDown = null;

    /**
     * Creates a new ToolbarGroup.
     *
     * @param {string} [title=''] - Initial title.
     * @param {object} [config={}] - Configuration options.
     */
    constructor(title = '', config = {}) {
        const me = this;

        me._boundOnPointerDown = me.onPointerDown.bind(me);

        me.title = title;

        if (config.movable !== undefined) {
            me.movable = config.movable;
        }
        if (config.parentContainer !== undefined) {
            me.parentContainer = config.parentContainer;
        }

        me._buildDOM();
        me._initEventListeners();
    }

    /**
     * Returns the unique type identifier for this toolbar group class.
     *
     * @returns {string} The type identifier.
     * @abstract
     */
    static get toolbarGroupType() {
        throw new Error('ToolbarGroup: Subclass must override static get toolbarGroupType()');
    }

    /**
     * Retrieves the parent container of this group.
     *
     * @returns {import('./ToolbarContainer.js').ToolbarContainer | null} The parent container.
     */
    get parentContainer() {
        return this._parentContainer;
    }

    /**
     * Sets the parent container for this group.
     * Validates that the value is an instance of ToolbarContainer or null.
     *
     * @param {import('./ToolbarContainer.js').ToolbarContainer | null} value - The new parent container.
     * @returns {void}
     */
    set parentContainer(value) {
        const me = this;
        const isValid =
            value === null ||
            (typeof value === 'object' && value.constructor.name === 'ToolbarContainer');

        if (!isValid) {
            console.warn(
                `[ToolbarGroup] invalid parentContainer assignment (${value}). Must be an instance of ToolbarContainer or null. Keeping previous value: ${me._parentContainer}`
            );
            return;
        }
        me._parentContainer = value;
    }

    /**
     * Retrieves the current title of the group.
     *
     * @returns {string | null} The title.
     */
    get title() {
        return this._title;
    }

    /**
     * Sets the title of the group and updates the DOM.
     * Updates the title element text and the drag handle's ARIA label.
     * Validates that the value is a string or null.
     *
     * @param {string | null} value - The new title.
     * @returns {void}
     */
    set title(value) {
        const me = this;
        if (value !== null && typeof value !== 'string') {
            console.warn(
                `[ToolbarGroup] invalid title assignment (${value}). Must be a string or null. Keeping previous value: ${me._title}`
            );
            return;
        }
        me._title = value;

        if (me._titleEl) {
            me._titleEl.textContent = value || '';
        }
        if (me._dragHandle) {
            me._dragHandle.setAttribute('aria-label', `Move ${value || 'Group'}`);
        }
    }

    /**
     * Checks if the group is movable.
     *
     * @returns {boolean} True if movable, false otherwise.
     */
    get movable() {
        return this._movable;
    }

    /**
     * Sets the movable state of the group.
     * Shows or hides the drag handle based on the value.
     * Validates that the value is a boolean.
     *
     * @param {boolean} value - The new movable state.
     * @returns {void}
     */
    set movable(value) {
        const me = this;
        if (typeof value !== 'boolean') {
            console.warn(
                `[ToolbarGroup] invalid movable assignment (${value}). Must be boolean. Keeping previous value: ${me._movable}`
            );
            return;
        }
        me._movable = value;

        if (me._dragHandle) {
            me._dragHandle.style.display = value ? '' : 'none';
        }
    }

    /**
     * Retrieves the content element container.
     *
     * @returns {HTMLElement | null} The content DOM element.
     */
    get contentElement() {
        return this._contentElement;
    }

    /**
     * Wrapper for parentContainer setter to maintain API compatibility.
     *
     * @param {import('./ToolbarContainer.js').ToolbarContainer | null} container - The new container.
     * @returns {void}
     */
    setParentContainer(container) {
        this.parentContainer = container;
    }

    /**
     * Builds the component's DOM structure with A11y attributes.
     *
     * @private
     * @returns {void}
     */
    _buildDOM() {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('toolbar-group');

        me._dragHandle = document.createElement('div');
        me._dragHandle.className = 'toolbar-group__handle';

        me._dragHandle.style.touchAction = 'none';

        me._dragHandle.setAttribute('role', 'button');
        me._dragHandle.setAttribute('tabindex', '0');
        me._dragHandle.setAttribute('aria-label', `Move ${me.title || 'Group'}`);
        me._dragHandle.setAttribute('aria-roledescription', 'draggable item');

        const icon = document.createElement('span');
        icon.className = 'icon icon-handle';
        icon.setAttribute('aria-hidden', 'true');

        me._dragHandle.appendChild(icon);
        me.element.appendChild(me._dragHandle);

        if (me.title) {
            me._titleEl = document.createElement('span');
            me._titleEl.className = 'toolbar-group__title';
            me._titleEl.textContent = me.title;
            me.element.appendChild(me._titleEl);
        }

        me._contentElement = document.createElement('div');
        me._contentElement.className = 'toolbar-group__content';
        me.element.appendChild(me._contentElement);

        if (!me.movable) {
            me._dragHandle.style.display = 'none';
        }
    }

    /**
     * Attaches Pointer listeners to the drag handle.
     *
     * @private
     * @returns {void}
     */
    _initEventListeners() {
        const me = this;
        if (me.movable && me._dragHandle) {
            me._dragHandle.addEventListener('pointerdown', me._boundOnPointerDown);
        }
    }

    /**
     * Cleans up listeners and removes the element from the DOM.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._state.movable && me._dragHandle) {
            me._dragHandle.removeEventListener('pointerdown', me._boundOnPointerDown);
        }
        me.element.remove();
    }

    /**
     * Pointer Down handler (Synthetic Drag Start).
     *
     * @param {PointerEvent} event - The native pointer event.
     * @returns {void}
     */
    onPointerDown(event) {
        const me = this;
        if (event.button !== 0) return;

        if (!me.movable) return;

        event.preventDefault();
        event.stopPropagation();

        const target = event.target;
        target.setPointerCapture(event.pointerId);

        appBus.emit(EventTypes.DND_DRAG_START, {
            item: me,
            type: 'ToolbarGroup',
            element: me.element,
            event: event
        });
    }

    /**
     * Serializes the group state to a JSON-compatible object.
     *
     * @returns {object} The serialized state.
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
     *
     * @param {object} data - The data to restore.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        if (data.id) {
            me.id = data.id;
        }
        if (data.title !== undefined) {
            me.title = data.title;
        }
    }

    /**
     * Returns the type identifier for this instance.
     *
     * @returns {string} The type string.
     * @abstract
     */
    getToolbarGroupType() {
        throw new Error('ToolbarGroup: Subclass must override getToolbarGroupType()');
    }

    /**
     * Renders the content of the group.
     *
     * @returns {void}
     * @abstract
     */
    render() {
        throw new Error('ToolbarGroup: Subclass must override render()');
    }
}
