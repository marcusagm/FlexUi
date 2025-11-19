import { ToolbarGroupFactory } from './ToolbarGroupFactory.js';
import { generateId } from '../../utils/generateId.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';

/**
 * Description:
 * Manages a "dockable" toolbar area (top, bottom, left, right).
 * It controls the orientation, scrolling for overflow, and acts as the
 * drop zone for ToolbarGroups.
 *
 * Properties summary:
 * - _state {object} : Internal state for orientation, position, and groups.
 * - id {string} : Unique identifier for the container instance.
 * - element {HTMLElement} : The main DOM element of the container.
 * - _scrollContainer {HTMLElement} : The scrollable content wrapper.
 * - _scrollPreviousButton {HTMLElement} : Button to scroll backward.
 * - _scrollNextButton {HTMLElement} : Button to scroll forward.
 * - _resizeObserver {ResizeObserver} : Observer for container resizing.
 * - _boundUpdateScrollButtons {Function} : Throttled function to update scroll buttons.
 *
 * Typical usage:
 * const toolbar = new ToolbarContainer('top', 'horizontal');
 * document.body.appendChild(toolbar.element);
 *
 * Events:
 * - Listens to (DOM): 'scroll' on _scrollContainer
 * - Listens to (DOM): 'click' on scroll buttons
 *
 * Business rules implemented:
 * - Manages scroll visibility using CSS class 'toolbar__scroll-btn--visible' directly on buttons.
 * - Updates 'is-empty' class based on the number of child groups.
 * - Supports A11y with ARIA roles, labels, and dynamic tabindex management.
 * - Uses throttling for scroll updates to optimize performance.
 *
 * Dependencies:
 * - {import('./ToolbarGroupFactory.js').ToolbarGroupFactory}
 * - {import('../../utils/generateId.js').generateId}
 * - {import('../../utils/ThrottleRAF.js').throttleRAF}
 *
 * Notes / Additional:
 * - The dropZoneType is 'toolbar-container'.
 */
export class ToolbarContainer {
    /**
     * Internal state for orientation, position, and groups.
     *
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
     * Unique identifier for the container instance.
     *
     * @type {string}
     * @public
     */
    id = generateId();

    /**
     * The main DOM element of the container.
     *
     * @type {HTMLElement | null}
     * @public
     */
    element = null;

    /**
     * The scrollable content wrapper.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _scrollContainer = null;

    /**
     * Button to scroll backward.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _scrollPreviousButton = null;

    /**
     * Button to scroll forward.
     *
     * @type {HTMLElement | null}
     * @private
     */
    _scrollNextButton = null;

    /**
     * Observer for container resizing.
     *
     * @type {ResizeObserver | null}
     * @private
     */
    _resizeObserver = null;

    /**
     * Throttled function to update scroll buttons.
     *
     * @type {Function | null}
     * @private
     */
    _boundUpdateScrollButtons = null;

    /**
     * Constructor for ToolbarContainer.
     *
     * @param {'top' | 'bottom' | 'left' | 'right'} position - The grid area name.
     * @param {'horizontal' | 'vertical'} orientation - The flex-direction.
     */
    constructor(position, orientation) {
        const me = this;
        me._state.position = position;
        me._state.orientation = orientation;
        me.dropZoneType = 'toolbar-container';

        me._boundUpdateScrollButtons = throttleRAF(me._updateScrollButtons.bind(me));

        me._buildDOM();
        me._initObservers();
        me._updateEmptyState();
    }

    /**
     * Builds the component's DOM structure with A11y attributes.
     *
     * @returns {void}
     * @private
     */
    _buildDOM() {
        const me = this;
        me.element = document.createElement('div');
        me.element.className = `toolbar-container toolbar-container--${me._state.position} toolbar-container--${me._state.orientation}`;
        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        me.element.setAttribute('role', 'toolbar');
        me.element.setAttribute('aria-orientation', me._state.orientation);
        me.element.setAttribute('aria-label', `${me._state.position} toolbar`);

        me._scrollPreviousButton = document.createElement('button');
        me._scrollPreviousButton.type = 'button';
        me._scrollPreviousButton.className = 'toolbar__scroll-btn toolbar__scroll-btn--prev';
        me._scrollPreviousButton.innerHTML =
            me._state.orientation === 'horizontal' ? '&#8249;' : '&#708;';
        me._scrollPreviousButton.setAttribute('aria-label', 'Scroll Previous');
        me._scrollPreviousButton.setAttribute('tabindex', '-1');
        me._scrollPreviousButton.addEventListener('click', me._onScrollPrevious.bind(me));

        me._scrollContainer = document.createElement('div');
        me._scrollContainer.className = 'toolbar__scroll-container';

        me._scrollContainer.addEventListener('scroll', me._boundUpdateScrollButtons, {
            passive: true
        });

        me._scrollNextButton = document.createElement('button');
        me._scrollNextButton.type = 'button';
        me._scrollNextButton.className = 'toolbar__scroll-btn toolbar__scroll-btn--next';
        me._scrollNextButton.innerHTML =
            me._state.orientation === 'horizontal' ? '&#8250;' : '&#709;';
        me._scrollNextButton.setAttribute('aria-label', 'Scroll Next');
        me._scrollNextButton.setAttribute('tabindex', '-1');
        me._scrollNextButton.addEventListener('click', me._onScrollNext.bind(me));

        me.element.append(me._scrollPreviousButton, me._scrollContainer, me._scrollNextButton);
    }

    /**
     * Initializes the ResizeObserver for the scroll container.
     *
     * @returns {void}
     * @private
     */
    _initObservers() {
        const me = this;
        me._resizeObserver = new ResizeObserver(() => {
            me._boundUpdateScrollButtons();
        });
        me._resizeObserver.observe(me._scrollContainer);
    }

    /**
     * Cleans up listeners and observers.
     *
     * @returns {void}
     */
    destroy() {
        const me = this;
        if (me._resizeObserver) {
            me._resizeObserver.disconnect();
        }
        me._boundUpdateScrollButtons?.cancel();

        me._state.groups.forEach(group => group.destroy());
        me.element.remove();
    }

    /**
     * Handles the "Scroll Previous" button click.
     *
     * @returns {void}
     * @private
     */
    _onScrollPrevious() {
        const me = this;
        const amount = -100;
        const options = { behavior: 'smooth' };

        if (me._state.orientation === 'horizontal') {
            options.left = amount;
        } else {
            options.top = amount;
        }
        me._scrollContainer.scrollBy(options);
    }

    /**
     * Handles the "Scroll Next" button click.
     *
     * @returns {void}
     * @private
     */
    _onScrollNext() {
        const me = this;
        const amount = 100;
        const options = { behavior: 'smooth' };

        if (me._state.orientation === 'horizontal') {
            options.left = amount;
        } else {
            options.top = amount;
        }
        me._scrollContainer.scrollBy(options);
    }

    /**
     * Updates scroll buttons visibility using CSS classes and manages tabindex.
     *
     * @returns {void}
     * @private
     */
    _updateScrollButtons() {
        const me = this;
        const target = me._scrollContainer;
        if (!target) {
            return;
        }

        const bufferPixel = 1;
        let hasPrevious = false;
        let hasNext = false;

        if (me._state.orientation === 'horizontal') {
            const { scrollLeft, scrollWidth, clientWidth } = target;
            hasPrevious = scrollLeft > bufferPixel;
            hasNext = scrollWidth > clientWidth + scrollLeft + bufferPixel;
        } else {
            const { scrollTop, scrollHeight, clientHeight } = target;
            hasPrevious = scrollTop > bufferPixel;
            hasNext = scrollHeight > clientHeight + scrollTop + bufferPixel;
        }

        // Updates visibility via CSS class on the buttons
        me._scrollPreviousButton.classList.toggle('toolbar__scroll-btn--visible', hasPrevious);
        me._scrollNextButton.classList.toggle('toolbar__scroll-btn--visible', hasNext);

        // Updates Accessibility (tabindex)
        if (hasPrevious) {
            me._scrollPreviousButton.removeAttribute('tabindex');
        } else {
            me._scrollPreviousButton.setAttribute('tabindex', '-1');
        }

        if (hasNext) {
            me._scrollNextButton.removeAttribute('tabindex');
        } else {
            me._scrollNextButton.setAttribute('tabindex', '-1');
        }
    }

    /**
     * Updates the 'is-empty' class on the container.
     *
     * @returns {void}
     * @private
     */
    _updateEmptyState() {
        const me = this;
        const isEmpty = me._state.groups.length === 0;
        me.element.classList.toggle('is-empty', isEmpty);
    }

    /**
     * Adds a ToolbarGroup to this container.
     *
     * @param {import('./ToolbarGroup.js').ToolbarGroup} group - The group to add.
     * @param {number|null} [index=null] - The index to insert at.
     * @returns {void}
     */
    addGroup(group, index = null) {
        const me = this;
        if (!group) {
            return;
        }

        const safeIndex = index === null ? me._state.groups.length : index;

        if (safeIndex >= me._state.groups.length) {
            me._state.groups.push(group);
            me._scrollContainer.appendChild(group.element);
        } else {
            me._state.groups.splice(safeIndex, 0, group);
            const nextSiblingGroup = me._state.groups[safeIndex + 1];
            const nextSiblingElement = nextSiblingGroup ? nextSiblingGroup.element : null;
            me._scrollContainer.insertBefore(group.element, nextSiblingElement);
        }
        group.setParentContainer(me);

        requestAnimationFrame(me._boundUpdateScrollButtons);
        me._updateEmptyState();
    }

    /**
     * Removes a ToolbarGroup from this container.
     *
     * @param {import('./ToolbarGroup.js').ToolbarGroup} group - The group to remove.
     * @returns {void}
     */
    removeGroup(group) {
        const me = this;
        const index = me._state.groups.indexOf(group);
        if (index === -1) {
            return;
        }

        me._state.groups.splice(index, 1);
        group.element.remove();
        group.setParentContainer(null);

        requestAnimationFrame(me._boundUpdateScrollButtons);
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
        const oldIndex = me._state.groups.indexOf(group);
        if (oldIndex === -1) {
            return;
        }

        if (oldIndex === newIndex) {
            return;
        }

        me._state.groups.splice(oldIndex, 1);
        const adjustedNewIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
        me._state.groups.splice(adjustedNewIndex, 0, group);

        const nextSiblingGroup = me._state.groups[adjustedNewIndex + 1];
        const nextSiblingElement = nextSiblingGroup ? nextSiblingGroup.element : null;
        me._scrollContainer.insertBefore(group.element, nextSiblingElement);

        requestAnimationFrame(me._boundUpdateScrollButtons);
        me._updateEmptyState();
    }

    /**
     * Serializes the ToolbarContainer state (child groups).
     *
     * @returns {Array<object>} An array of serialized group data.
     */
    toJSON() {
        const me = this;
        return me._state.groups.map(group => group.toJSON());
    }

    /**
     * Deserializes state from JSON data.
     *
     * @param {Array<object>} data - The array of child group data.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        me._state.groups.forEach(group => group.destroy());
        me._state.groups = [];
        me._scrollContainer.innerHTML = '';

        if (!Array.isArray(data)) {
            return;
        }

        const factory = ToolbarGroupFactory.getInstance();
        data.forEach(groupData => {
            const group = factory.createToolbarGroup(groupData);
            if (group) {
                me.addGroup(group);
            }
        });

        requestAnimationFrame(me._boundUpdateScrollButtons);
        me._updateEmptyState();
    }
}
