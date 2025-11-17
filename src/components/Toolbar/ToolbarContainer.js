import { ToolbarGroupFactory } from './ToolbarGroupFactory.js';
import { generateId } from '../../utils/generateId.js';

/**
 * Description:
 * Manages a "dockable" toolbar area (e.g., top, bottom, left, right).
 * It controls the orientation, scrolling for overflow, and acts as the
 * drop zone for ToolbarGroups.
 *
 * Properties summary:
 * - _state {object} : Manages orientation, position, and child groups.
 * - id {string} : A unique ID for this container instance.
 * - element {HTMLElement} : The main DOM element (.toolbar-container).
 * - _scrollContainer {HTMLElement} : The inner wrapper that scrolls.
 * - _scrollPrevBtn {HTMLElement} : The "scroll left/up" button.
 * - _scrollNextBtn {HTMLElement} : The "scroll right/down" button.
 * - _resizeObserver {ResizeObserver} : Monitors the container for overflow.
 *
 * Typical usage:
 * // In App.js
 * const topToolbar = new ToolbarContainer('top', 'horizontal');
 * appWrapper.appendChild(topToolbar.element);
 *
 * Events:
 * - (DND) Acts as a drop zone for 'ToolbarGroup' type.
 *
 * Business rules implemented:
 * - Adds/removes 'is-empty' class based on child count for CSS styling.
 *
 * Dependencies:
 * - ./ToolbarGroupFactory.js
 * - ../../utils/generateId.js
 */
export class ToolbarContainer {
    /**
     * @type {{
     * orientation: 'horizontal' | 'vertical',
     * position: 'top' | 'bottom' | 'left' | 'right',
     * groups: Array<import('./ToolbarGroup.js').ToolbarGroup>
     * }}
     * @private
     */
    _state = {
        orientation: 'horizontal',
        position: 'top',
        groups: []
    };

    /**
     * Unique ID for this container instance.
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * The main DOM element (.toolbar-container).
     * @type {HTMLElement | null}
     * @public
     */
    element = null;

    /**
     * The inner wrapper that scrolls.
     * @type {HTMLElement | null}
     * @private
     */
    _scrollContainer = null;

    /**
     * The "scroll left/up" button.
     * @type {HTMLElement | null}
     * @private
     */
    _scrollPrevBtn = null;

    /**
     * The "scroll right/down" button.
     * @type {HTMLElement | null}
     * @private
     */
    _scrollNextBtn = null;

    /**
     * Monitors the container for overflow.
     * @type {ResizeObserver | null}
     * @private
     */
    _resizeObserver = null;

    /**
     * @type {Function | null}
     * @private
     */
    _boundUpdateScrollButtons = null;

    /**
     * @param {'top' | 'bottom' | 'left' | 'right'} position - The grid area name.
     * @param {'horizontal' | 'vertical'} orientation - The flex-direction.
     */
    constructor(position, orientation) {
        const me = this;
        me._state.position = position;
        me._state.orientation = orientation;
        me.dropZoneType = 'toolbar-container';

        me._boundUpdateScrollButtons = me._updateScrollButtons.bind(me);

        me._buildDOM();
        me._initResizeObserver();
        me._updateEmptyState();
    }

    /**
     * Builds the component's DOM structure.
     * @private
     * @returns {void}
     */
    _buildDOM() {
        const me = this;
        me.element = document.createElement('div');
        me.element.className = `toolbar-container toolbar-container--${me._state.position} toolbar-container--${me._state.orientation}`;
        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        me._scrollPrevBtn = document.createElement('button');
        me._scrollPrevBtn.type = 'button';
        me._scrollPrevBtn.className = 'toolbar__scroll-btn toolbar__scroll-btn--prev';
        me._scrollPrevBtn.textContent = me._state.orientation === 'horizontal' ? '‹' : '⌃';
        me._scrollPrevBtn.addEventListener('click', me._onScrollPrev.bind(me));

        me._scrollContainer = document.createElement('div');
        me._scrollContainer.className = 'toolbar__scroll-container';

        me._scrollNextBtn = document.createElement('button');
        me._scrollNextBtn.type = 'button';
        me._scrollNextBtn.className = 'toolbar__scroll-btn toolbar__scroll-btn--next';
        me._scrollNextBtn.textContent = me._state.orientation === 'horizontal' ? '›' : '⌄';
        me._scrollNextBtn.addEventListener('click', me._onScrollNext.bind(me));

        me.element.append(me._scrollPrevBtn, me._scrollContainer, me._scrollNextBtn);
    }

    /**
     * Initializes the ResizeObserver for the scroll container.
     * @private
     * @returns {void}
     */
    _initResizeObserver() {
        const me = this;
        me._resizeObserver = new ResizeObserver(me._boundUpdateScrollButtons);
        me._resizeObserver.observe(me._scrollContainer);
    }

    /**
     * Cleans up listeners and observers.
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._resizeObserver) {
            me._resizeObserver.disconnect();
        }
        me._state.groups.forEach(group => group.destroy());
        me.element.remove();
    }

    /**
     * Handles the "Scroll Previous" button click.
     * @private
     * @returns {void}
     */
    _onScrollPrev() {
        const me = this;
        if (me._state.orientation === 'horizontal') {
            me._scrollContainer.scrollBy({ left: -100, behavior: 'smooth' });
        } else {
            me._scrollContainer.scrollBy({ top: -100, behavior: 'smooth' });
        }
    }

    /**
     * Handles the "Scroll Next" button click.
     * @private
     * @returns {void}
     */
    _onScrollNext() {
        const me = this;
        if (me._state.orientation === 'horizontal') {
            me._scrollContainer.scrollBy({ left: 100, behavior: 'smooth' });
        } else {
            me._scrollContainer.scrollBy({ top: 100, behavior: 'smooth' });
        }
    }

    /**
     * Shows or hides scroll buttons based on overflow.
     * @private
     * @returns {void}
     */
    _updateScrollButtons() {
        const me = this;
        const target = me._scrollContainer;
        if (!target) return;

        if (me._state.orientation === 'horizontal') {
            const { scrollLeft, scrollWidth, clientWidth } = target;
            me._scrollPrevBtn.style.display = scrollLeft > 1 ? '' : 'none';
            me._scrollNextBtn.style.display = scrollWidth > clientWidth + 1 ? '' : 'none';
        } else {
            const { scrollTop, scrollHeight, clientHeight } = target;
            me._scrollPrevBtn.style.display = scrollTop > 1 ? '' : 'none';
            me._scrollNextBtn.style.display = scrollHeight > clientHeight + 1 ? '' : 'none';
        }
    }

    /**
     * Updates the 'is-empty' class on the container.
     * @private
     * @returns {void}
     */
    _updateEmptyState() {
        const me = this;
        if (me._state.groups.length === 0) {
            me.element.classList.add('is-empty');
        } else {
            me.element.classList.remove('is-empty');
        }
    }

    /**
     * Adds a ToolbarGroup to this container.
     * @param {import('./ToolbarGroup.js').ToolbarGroup} group - The group to add.
     * @param {number|null} [index=null] - The index to insert at.
     * @returns {void}
     */
    addGroup(group, index = null) {
        const me = this;
        if (!group) return;

        const safeIndex = index === null ? me._state.groups.length : index;

        if (safeIndex >= me._state.groups.length) {
            me._state.groups.push(group);
            me._scrollContainer.appendChild(group.element);
        } else {
            me._state.groups.splice(safeIndex, 0, group);
            const nextSiblingGroup = me._state.groups[safeIndex + 1];
            const nextSiblingEl = nextSiblingGroup ? nextSiblingGroup.element : null;
            me._scrollContainer.insertBefore(group.element, nextSiblingEl);
        }
        group.setParentContainer(me);
        me._updateScrollButtons();
        me._updateEmptyState();
    }

    /**
     * Removes a ToolbarGroup from this container.
     * @param {import('./ToolbarGroup.js').ToolbarGroup} group - The group to remove.
     * @returns {void}
     */
    removeGroup(group) {
        const me = this;
        const index = me._state.groups.indexOf(group);
        if (index === -1) return;

        me._state.groups.splice(index, 1);
        group.element.remove();
        group.setParentContainer(null);
        me._updateScrollButtons();
        me._updateEmptyState();
    }

    /**
     * Moves a ToolbarGroup to a new index within this container.
     * @param {import('./ToolbarGroup.js').ToolbarGroup} group - The group to move.
     * @param {number} newIndex - The target index.
     * @returns {void}
     */
    moveGroup(group, newIndex) {
        const me = this;
        const oldIndex = me._state.groups.indexOf(group);
        if (oldIndex === -1) return;

        me._state.groups.splice(oldIndex, 1);
        const adjustedNewIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
        me._state.groups.splice(adjustedNewIndex, 0, group);

        const nextSiblingGroup = me._state.groups[adjustedNewIndex + 1];
        const nextSiblingEl = nextSiblingGroup ? nextSiblingGroup.element : null;
        me._scrollContainer.insertBefore(group.element, nextSiblingEl);

        me._updateScrollButtons();
        me._updateEmptyState();
    }

    /**
     * Serializes the ToolbarContainer state (child groups).
     * @returns {Array<object>}
     */
    toJSON() {
        const me = this;
        return me._state.groups.map(group => group.toJSON());
    }

    /**
     * Deserializes state from JSON data.
     * @param {Array<object>} data - The array of child group data.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        me._state.groups.forEach(group => group.destroy());
        me._state.groups = [];
        me._scrollContainer.innerHTML = '';

        if (!Array.isArray(data)) return;

        const factory = ToolbarGroupFactory.getInstance();
        data.forEach(groupData => {
            const group = factory.createToolbarGroup(groupData);
            if (group) {
                me.addGroup(group);
            }
        });

        me._updateScrollButtons();
        me._updateEmptyState();
    }
}
