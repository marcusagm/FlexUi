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
 * - _orientation {string} : The orientation of the toolbar ('horizontal' | 'vertical').
 * - _position {string} : The position in the layout ('top' | 'bottom' | 'left' | 'right').
 * - _groups {Array} : The list of child ToolbarGroups.
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
 * - Reactively updates DOM attributes/classes when orientation or position changes.
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
     * The orientation of the toolbar ('horizontal' | 'vertical').
     *
     * @type {'horizontal' | 'vertical'}
     * @private
     */
    _orientation = 'horizontal';

    /**
     * The position in the layout ('top' | 'bottom' | 'left' | 'right').
     *
     * @type {'top' | 'bottom' | 'left' | 'right'}
     * @private
     */
    _position = 'top';

    /**
     * The list of child ToolbarGroups.
     *
     * @type {Array<import('./ToolbarGroup.js').ToolbarGroup>}
     * @private
     */
    _groups = [];

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
        me.dropZoneType = 'toolbar-container';
        me._boundUpdateScrollButtons = throttleRAF(me._updateScrollButtons.bind(me));

        // Initial assignment (direct assignment to avoid premature side effects before DOM build)
        if (['top', 'bottom', 'left', 'right'].includes(position)) {
            me._position = position;
        }
        if (['horizontal', 'vertical'].includes(orientation)) {
            me._orientation = orientation;
        }

        me._buildDOM();
        me._initObservers();
        me._updateEmptyState();
    }

    /**
     * Retrieves the current orientation.
     *
     * @returns {'horizontal' | 'vertical'} The orientation.
     */
    get orientation() {
        const me = this;
        return me._orientation;
    }

    /**
     * Sets the orientation and updates DOM classes/attributes.
     * Validates input to ensure it is either 'horizontal' or 'vertical'.
     *
     * @param {'horizontal' | 'vertical'} value - The new orientation.
     * @returns {void}
     */
    set orientation(value) {
        const me = this;
        if (value !== 'horizontal' && value !== 'vertical') {
            console.warn(`[ToolbarContainer] Invalid orientation: ${value}`);
            return;
        }
        if (me._orientation === value) return;

        const oldValue = me._orientation;
        me._orientation = value;

        if (me.element) {
            me.element.classList.remove(`toolbar-container--${oldValue}`);
            me.element.classList.add(`toolbar-container--${value}`);
            me.element.setAttribute('aria-orientation', value);

            // Update scroll button icons
            if (me._scrollPreviousButton) {
                me._scrollPreviousButton.innerHTML = value === 'horizontal' ? '&#8249;' : '&#708;';
            }
            if (me._scrollNextButton) {
                me._scrollNextButton.innerHTML = value === 'horizontal' ? '&#8250;' : '&#709;';
            }
            // Force scroll update
            me._boundUpdateScrollButtons();
        }
    }

    /**
     * Retrieves the current position.
     *
     * @returns {'top' | 'bottom' | 'left' | 'right'} The position.
     */
    get position() {
        const me = this;
        return me._position;
    }

    /**
     * Sets the position and updates DOM classes/attributes.
     * Validates input.
     *
     * @param {'top' | 'bottom' | 'left' | 'right'} value - The new position.
     * @returns {void}
     */
    set position(value) {
        const me = this;
        if (!['top', 'bottom', 'left', 'right'].includes(value)) {
            console.warn(`[ToolbarContainer] Invalid position: ${value}`);
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
     * Retrieves the list of groups.
     * This is a read-only public accessor. Modification happens via addGroup/removeGroup.
     *
     * @returns {Array<import('./ToolbarGroup.js').ToolbarGroup>} The list of groups.
     */
    get groups() {
        const me = this;
        return me._groups;
    }

    /**
     * Retrieves the scrollable content wrapper.
     *
     * @returns {HTMLElement | null} The scroll container element.
     */
    get scrollContainer() {
        const me = this;
        return me._scrollContainer;
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

        me.element.className = `toolbar-container toolbar-container--${me._position} toolbar-container--${me._orientation}`;
        me.element.dataset.dropzone = me.dropZoneType;
        me.element.dropZoneInstance = me;

        me.element.setAttribute('role', 'toolbar');
        me.element.setAttribute('aria-orientation', me._orientation);
        me.element.setAttribute('aria-label', `${me._position} toolbar`);

        me._scrollPreviousButton = document.createElement('button');
        me._scrollPreviousButton.type = 'button';
        me._scrollPreviousButton.className = 'toolbar__scroll-btn toolbar__scroll-btn--prev';
        me._scrollPreviousButton.innerHTML =
            me._orientation === 'horizontal' ? '&#8249;' : '&#708;';
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
        me._scrollNextButton.innerHTML = me._orientation === 'horizontal' ? '&#8250;' : '&#709;';
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

        me._groups.forEach(group => group.destroy());
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

        if (me._orientation === 'horizontal') {
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

        if (me._orientation === 'horizontal') {
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

        if (me._orientation === 'horizontal') {
            const { scrollLeft, scrollWidth, clientWidth } = target;
            hasPrevious = scrollLeft > bufferPixel;
            hasNext = scrollWidth > clientWidth + scrollLeft + bufferPixel;
        } else {
            const { scrollTop, scrollHeight, clientHeight } = target;
            hasPrevious = scrollTop > bufferPixel;
            hasNext = scrollHeight > clientHeight + scrollTop + bufferPixel;
        }

        me._scrollPreviousButton.classList.toggle('toolbar__scroll-btn--visible', hasPrevious);
        me._scrollNextButton.classList.toggle('toolbar__scroll-btn--visible', hasNext);

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
        const isEmpty = me._groups.length === 0;
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

        const safeIndex = index === null ? me._groups.length : index;

        if (safeIndex >= me._groups.length) {
            me._groups.push(group);
            me._scrollContainer.appendChild(group.element);
        } else {
            me._groups.splice(safeIndex, 0, group);
            const nextSiblingGroup = me._groups[safeIndex + 1];
            const nextSiblingElement = nextSiblingGroup ? nextSiblingGroup.element : null;
            me._scrollContainer.insertBefore(group.element, nextSiblingElement);
        }
        // Uses public API of the group
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
        const index = me._groups.indexOf(group);
        if (index === -1) {
            return;
        }

        me._groups.splice(index, 1);
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
        const oldIndex = me._groups.indexOf(group);
        if (oldIndex === -1) {
            return;
        }

        if (oldIndex === newIndex) {
            return;
        }

        me._groups.splice(oldIndex, 1);
        const adjustedNewIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
        me._groups.splice(adjustedNewIndex, 0, group);

        const nextSiblingGroup = me._groups[adjustedNewIndex + 1];
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
        return me._groups.map(group => group.toJSON());
    }

    /**
     * Deserializes state from JSON data.
     *
     * @param {Array<object>} data - The array of child group data.
     * @returns {void}
     */
    fromJSON(data) {
        const me = this;
        me._groups.forEach(group => group.destroy());
        me._groups = [];
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
