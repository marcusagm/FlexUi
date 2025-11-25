import { UIItemStrip } from '../Core/UIItemStrip.js';
import { ToolbarGroup } from './ToolbarGroup.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * Manages a "dockable" toolbar area (top, bottom, left, right).
 * It extends UIItemStrip to inherit scroll and item management logic,
 * while adding specific behaviors for toolbar positioning and Drag-and-Drop.
 *
 * Properties summary:
 * - position {string} : The position in the layout ('top' | 'bottom' | 'left' | 'right').
 * - groups {Array<ToolbarGroup>} : The list of child ToolbarGroups (alias for items).
 * - orientation {string} : Inherited from UIItemStrip.
 *
 * Typical usage:
 * const toolbar = new ToolbarContainer('top', 'horizontal');
 * document.body.appendChild(toolbar.element);
 *
 * Events:
 * - (Inherits from UIItemStrip)
 *
 * Business rules implemented:
 * - Extends UIItemStrip for scroll/overflow handling.
 * - Acts as a 'toolbar-container' drop zone.
 * - Manages CSS classes for layout positioning.
 * - Updates 'is-empty' state based on content.
 *
 * Dependencies:
 * - {import('../Core/UIItemStrip.js').UIItemStrip}
 * - {import('./ToolbarGroup.js').ToolbarGroup}
 * - {import('../../utils/generateId.js').generateId}
 */
export class ToolbarContainer extends UIItemStrip {
    /**
     * The position in the layout ('top' | 'bottom' | 'left' | 'right').
     *
     * @type {'top' | 'bottom' | 'left' | 'right'}
     * @private
     */
    _position = 'top';

    /**
     * The drop zone type identifier.
     *
     * @type {string}
     * @public
     */
    dropZoneType = 'toolbar-container';

    /**
     * Constructor for ToolbarContainer.
     *
     * @param {'top' | 'bottom' | 'left' | 'right'} position - The grid area name.
     * @param {'horizontal' | 'vertical'} orientation - The flex-direction.
     */
    constructor(position, orientation) {
        // Initialize UIItemStrip with ID and basic config
        super(generateId(), { orientation: orientation });
        const me = this;

        // Validate and set position
        if (['top', 'bottom', 'left', 'right'].includes(position)) {
            me._position = position;
        } else {
            console.warn(`[ToolbarContainer] Invalid position: ${position}. Defaulting to 'top'.`);
        }

        // Initial render to ensure DOM is ready for appending/attributes
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
     * Sets the position and updates DOM classes/attributes.
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

        const oldValue = me._position;
        me._position = value;

        if (me.element) {
            me.element.classList.remove(`toolbar-container--${oldValue}`);
            me.element.classList.add(`toolbar-container--${value}`);
            me.element.setAttribute('aria-label', `${value} toolbar`);
        }
    }

    /**
     * Retrieves the scroll container.
     * Alias for accessing the viewport created by the strip adapter.
     * Used by DropStrategy.
     *
     * @returns {HTMLElement | null}
     */
    get scrollContainer() {
        const me = this;
        if (me.element) {
            return me.renderer.getScrollContainer(me.element);
        }
        return null;
    }

    /**
     * Retrieves the list of groups.
     * Alias for 'items' from UIItemStrip, cast to ToolbarGroup type.
     *
     * @returns {Array<import('./ToolbarGroup.js').ToolbarGroup>} The list of groups.
     */
    get groups() {
        return this.items;
    }

    /**
     * Adds a ToolbarGroup to this container.
     * Wraps UIItemStrip.addItem to maintain API compatibility and enforce type.
     *
     * @param {import('./ToolbarGroup.js').ToolbarGroup} group - The group to add.
     * @param {number|null} [index=null] - The index to insert at.
     * @returns {void}
     */
    addGroup(group, index = null) {
        const me = this;
        if (!(group instanceof ToolbarGroup)) {
            console.warn(`[ToolbarContainer] addGroup expects a ToolbarGroup instance.`, group);
            return;
        }

        // Use base class method
        me.addItem(group, index);

        // Set parent relationship
        group.setParentContainer(me);

        me._updateEmptyState();
    }

    /**
     * Removes a ToolbarGroup from this container.
     * Wraps UIItemStrip.removeItem.
     *
     * @param {import('./ToolbarGroup.js').ToolbarGroup} group - The group to remove.
     * @returns {void}
     */
    removeGroup(group) {
        const me = this;
        // Use base class method
        me.removeItem(group);

        if (group.parentContainer === me) {
            group.setParentContainer(null);
        }

        me._updateEmptyState();
    }

    /**
     * Moves a ToolbarGroup to a new index within this container.
     *
     * @param {import('./ToolbarGroup.js').ToolbarGroup} group - The group to move.
     * @param {number} newIndex - The target index.
     * @returns {void}
     */
    moveGroup(group, newIndex) {
        const me = this;
        const oldIndex = me.items.indexOf(group);

        if (oldIndex === -1) {
            console.warn('[ToolbarContainer] moveGroup: Group not found in container.');
            return;
        }
        if (oldIndex === newIndex) return;

        // To move in UIItemStrip, we remove and re-add.
        // This handles both array state and DOM position via the adapter.
        me.removeItem(group);
        me.addItem(group, newIndex);

        me._updateEmptyState();
    }

    /**
     * Updates the 'is-empty' class on the container.
     *
     * @private
     * @returns {void}
     */
    _updateEmptyState() {
        const me = this;
        if (me.element) {
            const isEmpty = me.items.length === 0;
            me.element.classList.toggle('is-empty', isEmpty);
        }
    }

    /**
     * Implementation of render logic.
     * Calls super to create the strip structure, then applies Toolbar-specific attributes/classes.
     *
     * @returns {HTMLElement} The root element.
     * @protected
     */
    _doRender() {
        const me = this;
        // Create base strip structure
        const element = super._doRender();

        // Add ToolbarContainer specific classes
        element.classList.add('toolbar-container');
        element.classList.add(`toolbar-container--${me._position}`);
        // Orientation class is handled by super based on config,
        // but ToolbarContainer uses specific modifier names in CSS if needed.
        // The base UIItemStrip adds 'ui-strip--horizontal', Toolbar CSS expects 'toolbar-container--horizontal'.
        element.classList.add(`toolbar-container--${me.orientation}`);

        // Configure DropZone
        element.dataset.dropzone = me.dropZoneType;
        element.dropZoneInstance = me;

        // A11y
        element.setAttribute('role', 'toolbar');
        element.setAttribute('aria-label', `${me._position} toolbar`);
        element.setAttribute('aria-orientation', me.orientation);

        return element;
    }

    /**
     * Override orientation setter to sync specific toolbar classes.
     *
     * @param {'horizontal' | 'vertical'} value
     * @returns {void}
     */
    set orientation(value) {
        const me = this;
        const oldValue = me.orientation; // Get current from super (or internal state before super set)
        super.orientation = value;

        if (me.element && oldValue !== value) {
            me.element.classList.remove(`toolbar-container--${oldValue}`);
            me.element.classList.add(`toolbar-container--${value}`);
            me.element.setAttribute('aria-orientation', value);
        }
    }

    /**
     * Serializes the ToolbarContainer state.
     *
     * @returns {Array<object>} An array of serialized group data.
     */
    toJSON() {
        const me = this;
        return me.items
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
        // Clear existing
        [...me.items].forEach(group => me.removeGroup(group));

        if (!Array.isArray(data)) {
            return;
        }

        // Dynamic import to avoid circular dependency issue during load if possible,
        // or rely on the globally available factory instance.
        // Assuming ToolbarGroupFactory is available or imported.
        // Since this file doesn't import Factory to avoid circular deps, we might need to
        // inject it or assume the caller handles hydration?
        // The original code imported ToolbarGroupFactory.
        // Let's re-import it dynamically or use a registry pattern if circular deps occur.
        // For now, proceeding with standard import approach as per original file structure.
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
}
