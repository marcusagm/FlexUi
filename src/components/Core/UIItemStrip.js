import { UIElement } from '../../core/UIElement.js';
import { VanillaStripAdapter } from '../../renderers/vanilla/VanillaStripAdapter.js';
import { throttleRAF } from '../../utils/ThrottleRAF.js';

/**
 * Description:
 * A generic controller for a strip of UI elements (horizontal or vertical) that handles
 * overflow, scrolling logic, and item management. It serves as the base class for
 * components like TabStrip or ToolbarScrollContainer.
 *
 * Properties summary:
 * - orientation {string} : The orientation of the strip ('horizontal' | 'vertical').
 * - items {Array<UIElement>} : The list of child elements managed by this strip.
 * - scrollAmount {number} : The distance in pixels to scroll when triggered.
 *
 * Typical usage:
 * class MyStrip extends UIItemStrip {
 * // ... specialization
 * }
 *
 * Events:
 * - (Inherits events from UIElement)
 *
 * Business rules implemented:
 * - Manages a list of UIElements.
 * - Automatically calculates scroll button visibility based on content overflow.
 * - Observes resize events to update UI state using throttled execution.
 * - Delegates DOM operations to VanillaStripAdapter.
 *
 * Dependencies:
 * - {import('../../core/UIElement.js').UIElement}
 * - {import('../../renderers/vanilla/VanillaStripAdapter.js').VanillaStripAdapter}
 * - {import('../../utils/ThrottleRAF.js').throttleRAF}
 */
export class UIItemStrip extends UIElement {
    /**
     * The list of child elements managed by this strip.
     *
     * @type {Array<UIElement>}
     * @private
     */
    _items = [];

    /**
     * The orientation of the strip.
     *
     * @type {'horizontal' | 'vertical'}
     * @private
     */
    _orientation = 'horizontal';

    /**
     * The distance in pixels to scroll when triggered.
     *
     * @type {number}
     * @private
     */
    _scrollAmount = 100;

    /**
     * Throttled function to update scroll buttons.
     *
     * @type {Function | null}
     * @private
     */
    _boundUpdateScrollButtons = null;

    /**
     * Creates an instance of UIItemStrip.
     *
     * @param {string} [id=null] - Optional unique ID.
     * @param {object} [config={}] - Configuration options.
     * @param {string} [config.orientation='horizontal'] - Initial orientation.
     * @param {import('../../core/IRenderer.js').IRenderer} [renderer=null] - Optional renderer adapter.
     */
    constructor(id = null, config = {}, renderer = null) {
        super(id, renderer || new VanillaStripAdapter());
        const me = this;

        if (config.orientation) {
            me.orientation = config.orientation;
        }

        me._boundUpdateScrollButtons = throttleRAF(me._updateScrollButtons.bind(me));
    }

    /**
     * Retrieves the list of items.
     *
     * @returns {Array<UIElement>} The items array.
     */
    get items() {
        return this._items;
    }

    /**
     * Retrieves the orientation.
     *
     * @returns {'horizontal' | 'vertical'} The current orientation.
     */
    get orientation() {
        return this._orientation;
    }

    /**
     * Sets the orientation.
     *
     * @param {'horizontal' | 'vertical'} value - The new orientation.
     * @returns {void}
     */
    set orientation(value) {
        const me = this;
        if (value !== 'horizontal' && value !== 'vertical') {
            console.warn(
                `[UIItemStrip] invalid orientation assignment (${value}). Must be 'horizontal' or 'vertical'.`
            );
            return;
        }
        me._orientation = value;
        if (me.element) {
            me.renderer.updateOrientation(me.element, value);
            me._boundUpdateScrollButtons();
        }
    }

    /**
     * Adds an item to the strip.
     *
     * @param {UIElement} item - The item to add.
     * @param {number|null} [index=null] - The index to insert at.
     * @returns {void}
     */
    addItem(item, index = null) {
        const me = this;
        if (!(item instanceof UIElement)) {
            console.warn(`[UIItemStrip] invalid item assignment (${item}). Must be a UIElement.`);
            return;
        }

        const safeIndex = index === null ? me._items.length : index;

        if (safeIndex >= me._items.length) {
            me._items.push(item);
        } else {
            me._items.splice(safeIndex, 0, item);
        }

        if (me.isMounted) {
            me._mountItemDOM(item, safeIndex);
            me._boundUpdateScrollButtons();
        }
    }

    /**
     * Removes an item from the strip.
     *
     * @param {UIElement} item - The item to remove.
     * @returns {void}
     */
    removeItem(item) {
        const me = this;
        const index = me._items.indexOf(item);
        if (index === -1) {
            return;
        }

        me._items.splice(index, 1);

        if (me.isMounted) {
            me._unmountItemDOM(item);
            me._boundUpdateScrollButtons();
        }
    }

    /**
     * Scrolls the strip in the specified direction.
     *
     * @param {number} direction - -1 for previous/up, 1 for next/down.
     * @returns {void}
     */
    scroll(direction) {
        const me = this;
        if (!me.element) return;

        const amount = me._scrollAmount * direction;
        me.renderer.scroll(me.element, me._orientation, amount);
    }

    /**
     * Implementation of render logic.
     *
     * @returns {HTMLElement} The root element created by the adapter.
     * @protected
     */
    _doRender() {
        const me = this;
        const element = me.renderer.createStripElement(me.id, me._orientation);

        // Setup scroll listeners on the buttons created by the adapter
        const prevBtn = me.renderer.getScrollButton(element, 'prev');
        const nextBtn = me.renderer.getScrollButton(element, 'next');

        if (prevBtn) {
            me.renderer.on(prevBtn, 'click', () => me.scroll(-1));
        }
        if (nextBtn) {
            me.renderer.on(nextBtn, 'click', () => me.scroll(1));
        }

        const scrollContainer = me.renderer.getScrollContainer(element);
        if (scrollContainer) {
            me.renderer.on(scrollContainer, 'scroll', me._boundUpdateScrollButtons, {
                passive: true
            });
        }

        return element;
    }

    /**
     * Implementation of mount logic.
     *
     * @param {HTMLElement} container - The parent container.
     * @protected
     */
    _doMount(container) {
        const me = this;
        if (me.element) {
            me.renderer.mount(container, me.element);
        }

        // Mount all items
        me._items.forEach((item, index) => {
            me._mountItemDOM(item, index);
        });

        // Start observing resize
        if (me.element) {
            me.renderer.observeResize(me.element, me._boundUpdateScrollButtons);
        }

        // Initial check
        me._boundUpdateScrollButtons();
    }

    /**
     * Implementation of unmount logic.
     *
     * @protected
     */
    _doUnmount() {
        const me = this;
        // Stop observing resize
        if (me.element) {
            me.renderer.unobserveResize(me.element);
        }

        // Unmount items (but do not dispose them here, logic ownership may vary)
        me._items.forEach(item => {
            me._unmountItemDOM(item);
        });

        if (me.element && me.element.parentNode) {
            me.renderer.unmount(me.element.parentNode, me.element);
        }
    }

    /**
     * Mounts an item's DOM element into the strip.
     *
     * @param {UIElement} item - The item.
     * @param {number} index - The index.
     * @private
     */
    _mountItemDOM(item, index) {
        const me = this;
        if (!item.element) {
            item.render();
        }
        // Delegate insertion to adapter to handle correct container placement (inside scroll wrapper)
        me.renderer.mountItem(me.element, item.element, index);
    }

    /**
     * Unmounts an item's DOM element from the strip.
     *
     * @param {UIElement} item - The item.
     * @private
     */
    _unmountItemDOM(item) {
        const me = this;
        if (item.element) {
            me.renderer.unmountItem(me.element, item.element);
        }
    }

    /**
     * Calculates and updates the visibility of scroll buttons.
     *
     * @private
     * @returns {void}
     */
    _updateScrollButtons() {
        const me = this;
        if (!me.element) return;

        const dimensions = me.renderer.getScrollDimensions(me.element);
        if (!dimensions) return;

        const { scrollTop, scrollLeft, scrollWidth, scrollHeight, clientWidth, clientHeight } =
            dimensions;
        const bufferPixel = 1;
        let hasPrevious = false;
        let hasNext = false;

        if (me._orientation === 'horizontal') {
            hasPrevious = scrollLeft > bufferPixel;
            hasNext = scrollWidth > clientWidth + scrollLeft + bufferPixel;
        } else {
            hasPrevious = scrollTop > bufferPixel;
            hasNext = scrollHeight > clientHeight + scrollTop + bufferPixel;
        }

        me.renderer.setScrollButtonsVisibility(me.element, hasPrevious, hasNext);
    }
}
