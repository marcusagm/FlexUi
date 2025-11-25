import { UIElement } from '../../core/UIElement.js';
import { UIItemStrip } from '../Core/UIItemStrip.js';
import { ToolbarGroup } from './ToolbarGroup.js';
import { generateId } from '../../utils/generateId.js';
import { VanillaToolbarContainerAdapter } from '../../renderers/vanilla/VanillaToolbarContainerAdapter.js';
import { DropZoneType } from '../../constants/DNDTypes.js';

/**
 * Description:
 * Manages a "dockable" toolbar area (top, bottom, left, right).
 * It acts as a controller that composes a UIItemStrip to handle the list of
 * ToolbarGroups and their scrolling behavior. It delegates the container's
 * DOM rendering to VanillaToolbarContainerAdapter.
 *
 * Properties summary:
 * - position {string} : The position in the layout ('top' | 'bottom' | 'left' | 'right').
 * - orientation {string} : The orientation of the toolbar ('horizontal' | 'vertical').
 * - groups {Array<ToolbarGroup>} : The list of child ToolbarGroups (proxied from strip).
 * - scrollContainer {HTMLElement} : The scrollable area (proxied from strip).
 * - dropZoneType {string} : The identifier for the DragDropService.
 *
 * Typical usage:
 * const toolbar = new ToolbarContainer('top', 'horizontal');
 * document.body.appendChild(toolbar.element);
 *
 * Events:
 * - None (Delegates events to Strip or emits via appBus in groups)
 *
 * Business rules implemented:
 * - Composes UIItemStrip for scroll and item management.
 * - Delegates visual operations to VanillaToolbarContainerAdapter.
 * - Manages 'is-empty' state based on the strip's item count.
 * - Acts as a 'toolbar-container' drop zone.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../Core/UIItemStrip.js').UIItemStrip}
 * - {import('../../renderers/vanilla/VanillaToolbarContainerAdapter.js').VanillaToolbarContainerAdapter}
 * - {import('./ToolbarGroup.js').ToolbarGroup}
 * - {import('../../utils/generateId.js').generateId}
 * - {import('../../constants/DNDTypes.js').DropZoneType}
 */
export class ToolbarContainer extends UIElement {
    /**
     * The position in the layout.
     *
     * @type {'top' | 'bottom' | 'left' | 'right'}
     * @private
     */
    _position = 'top';

    /**
     * The orientation of the toolbar.
     *
     * @type {'horizontal' | 'vertical'}
     * @private
     */
    _orientation = 'horizontal';

    /**
     * The internal strip component managing items and scrolling.
     *
     * @type {UIItemStrip}
     * @private
     */
    _strip;

    /**
     * The drop zone type identifier.
     *
     * @type {string}
     * @public
     */
    dropZoneType = DropZoneType.TOOLBAR_CONTAINER;

    /**
     * Creates a new ToolbarContainer instance.
     *
     * @param {'top' | 'bottom' | 'left' | 'right'} position - The grid area name.
     * @param {'horizontal' | 'vertical'} orientation - The flex-direction.
     * @param {object} [config={}] - Configuration options.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(position, orientation, config = {}, renderer = null) {
        super(generateId(), renderer || new VanillaToolbarContainerAdapter());
        const me = this;

        if (['top', 'bottom', 'left', 'right'].includes(position)) {
            me._position = position;
        } else {
            console.warn(`[ToolbarContainer] Invalid position: ${position}. Defaulting to 'top'.`);
        }

        if (['horizontal', 'vertical'].includes(orientation)) {
            me._orientation = orientation;
        }

        // Initialize the inner strip for item management
        // [CORREÇÃO] Disable overflow menu for toolbars, as they only use scroll buttons
        me._strip = new UIItemStrip(me.id + '-strip', {
            orientation: me._orientation,
            enableOverflowMenu: false
        });

        // Initialize DOM via UIElement lifecycle
        me.render();
        me._updateEmptyState();
    }

    /**
     * Retrieves the current position.
     *
     * @returns {'top' | 'bottom' | 'left' | 'right'} The position.
     */
    get position() {
        return this._position;
    }

    /**
     * Sets the position and updates DOM classes/attributes via adapter.
     *
     * @param {'top' | 'bottom' | 'left' | 'right'} value - The new position.
     * @returns {void}
     */
    set position(value) {
        const me = this;
        if (!['top', 'bottom', 'left', 'right'].includes(value)) {
            console.warn(`[ToolbarContainer] Invalid position assignment: ${value}`);
            return;
        }
        if (me._position === value) return;

        me._position = value;
        me._updateConfiguration();
    }

    /**
     * Retrieves the current orientation.
     *
     * @returns {'horizontal' | 'vertical'} The orientation.
     */
    get orientation() {
        return this._orientation;
    }

    /**
     * Sets the orientation. Updates local state, adapter, and the inner strip.
     *
     * @param {'horizontal' | 'vertical'} value - The new orientation.
     * @returns {void}
     */
    set orientation(value) {
        const me = this;
        if (value !== 'horizontal' && value !== 'vertical') {
            console.warn(`[ToolbarContainer] Invalid orientation assignment: ${value}`);
            return;
        }
        if (me._orientation === value) return;

        me._orientation = value;
        me._strip.orientation = value; // Propagate to strip
        me._updateConfiguration();
    }

    /**
     * Retrieves the list of groups from the inner strip.
     *
     * @returns {Array<ToolbarGroup>} The list of groups.
     */
    get groups() {
        // Safe cast assuming only ToolbarGroups are added
        return this._strip.items;
    }

    /**
     * Retrieves the effective scroll container element.
     * Used by DropStrategies to locate where items are physically mounted.
     *
     * @returns {HTMLElement | null} The strip's viewport element.
     */
    get scrollContainer() {
        if (this._strip && this._strip.element) {
            return (
                this._strip.renderer.getScrollContainer(this._strip.element) || this._strip.element
            );
        }
        return null;
    }

    // --- UIElement Overrides ---

    /**
     * Implementation of the rendering logic.
     * Uses the adapter to create the container structure.
     *
     * @returns {HTMLElement} The root element.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createContainerElement(me.id);

        // Apply initial configuration
        me.renderer.updateConfiguration(element, me._position, me._orientation);

        // Configure DropZone
        element.dataset.dropzone = me.dropZoneType;
        element.dropZoneInstance = me;

        return element;
    }

    /**
     * Implementation of the mounting logic.
     * Mounts the inner strip into the container.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        // Mount self to parent
        if (me.element) {
            me.renderer.mount(container, me.element);

            // Mount inner strip to self
            const stripContainer = me.renderer.getStripContainer(me.element);
            if (stripContainer) {
                me._strip.mount(stripContainer);
            }
        }
    }

    /**
     * Implementation of the unmounting logic.
     * Unmounts the inner strip and self.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;
        if (me._strip.isMounted) {
            me._strip.unmount();
        }

        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
    }

    // --- Group Management ---

    /**
     * Adds a ToolbarGroup to this container.
     * Delegates to the inner strip.
     *
     * @param {ToolbarGroup} group - The group to add.
     * @param {number|null} [index=null] - The index to insert at.
     * @returns {void}
     */
    addGroup(group, index = null) {
        const me = this;
        if (!(group instanceof ToolbarGroup)) {
            console.warn(`[ToolbarContainer] addGroup expects a ToolbarGroup instance.`, group);
            return;
        }

        me._strip.addItem(group, index);
        group.setParentContainer(me);
        me._updateEmptyState();
    }

    /**
     * Removes a ToolbarGroup from this container.
     * Delegates to the inner strip.
     *
     * @param {ToolbarGroup} group - The group to remove.
     * @returns {void}
     */
    removeGroup(group) {
        const me = this;
        me._strip.removeItem(group);

        if (group.parentContainer === me) {
            group.setParentContainer(null);
        }
        me._updateEmptyState();
    }

    /**
     * Moves a ToolbarGroup to a new index within this container.
     *
     * @param {ToolbarGroup} group - The group to move.
     * @param {number} newIndex - The target index.
     * @returns {void}
     */
    moveGroup(group, newIndex) {
        const me = this;
        // Use strip's logic to move (remove + add)
        const oldIndex = me.groups.indexOf(group);
        if (oldIndex === -1) return;
        if (oldIndex === newIndex) return;

        me._strip.removeItem(group);
        me._strip.addItem(group, newIndex);

        me._updateEmptyState();
    }

    /**
     * Serializes the ToolbarContainer state.
     *
     * @returns {Array<object>} An array of serialized group data.
     */
    toJSON() {
        const me = this;
        return me.groups
            .map(group => {
                if (typeof group.toJSON === 'function') {
                    return group.toJSON();
                }
                return null;
            })
            .filter(Boolean);
    }

    /**
     * Deserializes state from JSON data.
     *
     * @param {Array<object>} data - The array of child group data.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        // Clear existing groups
        [...me.groups].forEach(group => me.removeGroup(group));

        if (!Array.isArray(data)) {
            return;
        }

        // Use dynamic import for factory to avoid circular dependencies
        import('./ToolbarGroupFactory.js').then(({ ToolbarGroupFactory }) => {
            const factory = ToolbarGroupFactory.getInstance();
            data.forEach(groupData => {
                const group = factory.createToolbarGroup(groupData);
                if (group) {
                    me.addGroup(group);
                }
            });
        });
    }

    /**
     * Disposes the container and its inner strip.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me._strip) {
            me._strip.dispose();
        }
        // Groups are often managed by factory or app state, but if we own them:
        [...me.groups].forEach(group => group.dispose());

        super.dispose();
    }

    // --- Private Helpers ---

    /**
     * Updates the adapter configuration based on current properties.
     *
     * @private
     * @returns {void}
     */
    _updateConfiguration() {
        const me = this;
        if (me.element) {
            me.renderer.updateConfiguration(me.element, me._position, me._orientation);
        }
    }

    /**
     * Updates the 'is-empty' state on the adapter.
     *
     * @private
     * @returns {void}
     */
    _updateEmptyState() {
        const me = this;
        if (me.element) {
            const isEmpty = me.groups.length === 0;
            me.renderer.setEmptyState(me.element, isEmpty);
        }
    }
}
