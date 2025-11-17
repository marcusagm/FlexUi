import { appBus } from '../../utils/EventBus.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * The abstract base class for a "Toolbar Group".
 * A ToolbarGroup is a self-contained, draggable UI component.
 * Updated with A11y attributes and Synthetic Pointer Drag.
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
     * The main DOM element.
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
     * @type {HTMLElement | null}
     * @private
     */
    _titleEl = null;

    /**
     * @type {HTMLElement | null}
     * @private
     */
    _contentElement = null;

    /**
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * @type {Function | null}
     * @private
     */
    _boundOnPointerDown = null;

    /**
     * @param {string} [title='']
     * @param {object} [config={}]
     */
    constructor(title = '', config = {}) {
        const me = this;
        Object.assign(me._state, config);
        me._state.title = title;

        me._boundOnPointerDown = me.onPointerDown.bind(me);

        me._buildDOM();
        me._initEventListeners();
    }

    /**
     * <toolbarGroupType> static getter.
     * @returns {string}
     * @abstract
     */
    static get toolbarGroupType() {
        throw new Error('ToolbarGroup: Subclass must override static get toolbarGroupType()');
    }

    /**
     * <contentElement> getter.
     */
    get contentElement() {
        return this._contentElement;
    }

    /**
     * <ParentContainer> setter.
     */
    setParentContainer(container) {
        this._state.parentContainer = container;
    }

    /**
     * Builds the component's DOM structure with A11y.
     * @private
     */
    _buildDOM() {
        const me = this;
        me.element = document.createElement('div');
        me.element.classList.add('toolbar-group');

        // Drag Handle Construction
        me._dragHandle = document.createElement('div');
        me._dragHandle.className = 'toolbar-group__handle';

        // Synthetic Drag Setup
        me._dragHandle.style.touchAction = 'none';

        // A11y Attributes for Drag Handle
        me._dragHandle.setAttribute('role', 'button');
        me._dragHandle.setAttribute('tabindex', '0'); // Make focusable
        me._dragHandle.setAttribute('aria-label', `Move ${me._state.title || 'Group'}`);
        me._dragHandle.setAttribute('aria-roledescription', 'draggable item');

        const icon = document.createElement('span');
        icon.className = 'icon icon-handle';
        icon.setAttribute('aria-hidden', 'true');

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
     * Attaches Pointer listeners.
     * @private
     */
    _initEventListeners() {
        const me = this;
        if (me._state.movable && me._dragHandle) {
            me._dragHandle.addEventListener('pointerdown', me._boundOnPointerDown);
        }
    }

    /**
     * Cleans up.
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
     */
    onPointerDown(e) {
        const me = this;
        if (e.button !== 0) return;

        if (!me._state.movable) return;

        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        target.setPointerCapture(e.pointerId);

        appBus.emit('dragstart', {
            item: me,
            type: 'ToolbarGroup',
            element: me.element,
            event: e
        });
    }

    /**
     * Serializes state.
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
     * Deserializes state.
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
            if (me._dragHandle) {
                me._dragHandle.setAttribute('aria-label', `Move ${data.title || 'Group'}`);
            }
        }
    }

    /**
     * Abstract getter.
     */
    getToolbarGroupType() {
        throw new Error('ToolbarGroup: Subclass must override getToolbarGroupType()');
    }

    /**
     * Abstract render.
     */
    render() {
        throw new Error('ToolbarGroup: Subclass must override render()');
    }
}
