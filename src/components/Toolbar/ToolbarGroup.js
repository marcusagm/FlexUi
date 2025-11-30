import { UIElement } from '../../core/UIElement.js';
import { VanillaToolbarAdapter } from '../../renderers/vanilla/VanillaToolbarAdapter.js';
import { Event } from '../../utils/Event.js';
import { EventTypes } from '../../constants/EventTypes.js';

/**
 * Description:
 * The abstract base class for a "Toolbar Group".
 * A ToolbarGroup is a self-contained, draggable UI component.
 * It inherits from UIElement to participate in the standard lifecycle and
 * delegates rendering to an adapter.
 *
 * Properties summary:
 * - parentContainer {ToolbarContainer} : The container this group belongs to.
 * - title {string} : The visual title of the group.
 * - movable {boolean} : Whether the group is draggable.
 * - contentElement {HTMLElement} : The container for the group's content buttons.
 *
 * Typical usage:
 * // Subclass implementation
 * class MyGroup extends ToolbarGroup {
 * populate() {
 * // Add buttons to this.contentElement
 * }
 * }
 *
 * Events:
 * - Emits: EventTypes.DND_DRAG_START (via Event)
 *
 * Business rules implemented:
 * - Extends UIElement -> Disposable.
 * - Delegates visual operations to VanillaToolbarAdapter.
 * - Manages drag interaction via synthetic pointer events.
 * - Enforces "populate" method for subclasses.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaToolbarAdapter.js').VanillaToolbarAdapter}
 * - {import('../../utils/Event.js').Event}
 */
export class ToolbarGroup extends UIElement {
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
     * @type {string}
     * @private
     */
    _title = '';

    /**
     * Whether the group handles dragging.
     *
     * @type {boolean}
     * @private
     */
    _movable = true;

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
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(title = '', config = {}, renderer = null) {
        super(null, renderer || new VanillaToolbarAdapter());
        const me = this;

        me._title = typeof title === 'string' ? title : '';

        if (config.movable !== undefined) {
            me._movable = Boolean(config.movable);
        }
        if (config.parentContainer !== undefined) {
            me._parentContainer = config.parentContainer;
        }

        me._boundOnPointerDown = me.onPointerDown.bind(me);

        // Ensure element is created immediately for compatibility
        me.render();
    }

    /**
     * Returns the unique type identifier for this toolbar group class.
     *
     * @returns {string} The type identifier.
     * @abstract
     */
    static get toolbarGroupType() {
        throw new Error(
            "Method 'static get toolbarGroupType()' must be implemented by subclasses of ToolbarGroup."
        );
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
     *
     * @param {import('./ToolbarContainer.js').ToolbarContainer | null} value - The new parent container.
     * @returns {void}
     */
    set parentContainer(value) {
        const me = this;
        if (
            value !== null &&
            (typeof value !== 'object' || value.constructor.name !== 'ToolbarContainer')
        ) {
            console.warn(
                `[ToolbarGroup] invalid parentContainer assignment (${value}). Must be an instance of ToolbarContainer or null.`
            );
            return;
        }
        me._parentContainer = value;
    }

    /**
     * Retrieves the current title of the group.
     *
     * @returns {string} The title.
     */
    get title() {
        return this._title;
    }

    /**
     * Sets the title of the group and updates the DOM via renderer.
     *
     * @param {string} value - The new title.
     * @returns {void}
     */
    set title(value) {
        const me = this;
        if (typeof value !== 'string') {
            console.warn(
                `[ToolbarGroup] invalid title assignment (${value}). Must be a string. Keeping previous value: ${me._title}`
            );
            return;
        }
        me._title = value;
        if (me.element) {
            me.renderer.updateTitle(me.element, value);
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
        if (me.element) {
            me.renderer.setMovable(me.element, value);
        }
    }

    /**
     * Retrieves the content element container.
     *
     * @returns {HTMLElement | null} The content DOM element.
     */
    get contentElement() {
        const me = this;
        if (me.element) {
            return me.renderer.getContentElement(me.element);
        }
        return null;
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
     * Implementation of the rendering logic.
     * Uses the adapter to create the group DOM structure.
     *
     * @returns {HTMLElement} The root group element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createGroupElement(me.id);

        me.renderer.updateTitle(element, me._title);
        me.renderer.setMovable(element, me._movable);

        // Attach drag listener
        const dragHandle = me.renderer.getDragHandle(element);
        if (dragHandle) {
            me.renderer.on(dragHandle, 'pointerdown', me._boundOnPointerDown);
        }

        return element;
    }

    /**
     * Extended render method to trigger population.
     * Ensures subclass content is added after the base structure is ready.
     *
     * @returns {void}
     */
    render() {
        super.render();
        this.populate();
    }

    /**
     * Implementation of unmount logic.
     * Cleans up listeners and element.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;
        // Clean up drag handle listener
        if (me.element) {
            const dragHandle = me.renderer.getDragHandle(me.element);
            if (dragHandle) {
                me.renderer.off(dragHandle, 'pointerdown', me._boundOnPointerDown);
            }
            // Unmount root
            if (me.element.parentNode) {
                me.renderer.unmount(me.element.parentNode, me.element);
            }
        }
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
        if (!me._movable) return;

        event.preventDefault();
        event.stopPropagation();

        const target = event.target;
        if (target && typeof target.setPointerCapture === 'function') {
            target.setPointerCapture(event.pointerId);
        }

        // Access public element getter from UIElement
        Event.emit(EventTypes.DND_DRAG_START, {
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
            type: me.getToolbarGroupType(),
            title: me.title
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
        throw new Error(
            "Method 'getToolbarGroupType()' must be implemented by subclasses of ToolbarGroup."
        );
    }

    /**
     * Renders the content of the group.
     * Replaces the old abstract 'render()' method to avoid conflict with UIElement.
     *
     * @returns {void}
     * @abstract
     */
    populate() {
        throw new Error("Method 'populate()' must be implemented by subclasses of ToolbarGroup.");
    }
}
