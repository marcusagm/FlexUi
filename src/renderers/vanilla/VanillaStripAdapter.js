import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering generic strip containers (lists of items with scroll controls).
 * It extends VanillaRenderer to handle the specific DOM structure required for scrolling lists,
 * such as TabStrips or ToolbarContainers. It manages the viewport, scroll buttons, and item placement.
 *
 * Properties summary:
 * - _resizeObservers {WeakMap<HTMLElement, ResizeObserver>} : Maps DOM elements to their ResizeObservers.
 *
 * Typical usage:
 * const adapter = new VanillaStripAdapter();
 * const strip = adapter.createStripElement('my-strip', 'horizontal');
 * adapter.mountItem(strip, itemElement);
 * adapter.observeResize(strip, () => console.log('resized'));
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces a standard structure: Button Prev -> Viewport -> Button Next.
 * - Manages ResizeObserver lifecycle for the strip elements.
 * - Handles orientation-specific styles and scrolling logic.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaStripAdapter extends VanillaRenderer {
    /**
     * Maps DOM elements to their ResizeObservers to allow unobserving later.
     *
     * @type {WeakMap<HTMLElement, ResizeObserver>}
     * @private
     */
    _resizeObservers = new WeakMap();

    /**
     * Creates an instance of VanillaStripAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM structure for the strip.
     *
     * @param {string} id - The unique ID of the strip.
     * @param {'horizontal'|'vertical'} orientation - The initial orientation.
     * @returns {HTMLElement} The root strip element.
     * @throws {Error} If inputs are invalid.
     */
    createStripElement(id, orientation) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaStripAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }
        if (orientation !== 'horizontal' && orientation !== 'vertical') {
            throw new Error(
                `[VanillaStripAdapter] Invalid orientation: "${orientation}". Must be 'horizontal' or 'vertical'.`
            );
        }

        const stripElement = me.createElement('div', {
            className: `ui-strip ui-strip--${orientation}`,
            id: `strip-${id}`
        });

        // Ensure flex layout
        me.updateStyles(stripElement, {
            display: 'flex',
            flexDirection: orientation === 'horizontal' ? 'row' : 'column',
            overflow: 'hidden' // Hide overflow of the container itself
        });

        // 1. Previous Button
        const prevButton = me.createElement('button', {
            className: 'ui-strip__scroll-btn ui-strip__scroll-btn--prev',
            type: 'button'
        });
        prevButton.innerHTML = orientation === 'horizontal' ? '&#8249;' : '&#708;';
        me.updateStyles(prevButton, { display: 'none' }); // Hidden by default

        // 2. Viewport (Scroll Container)
        const viewport = me.createElement('div', {
            className: 'ui-strip__viewport'
        });
        me.updateStyles(viewport, {
            flex: '1',
            overflow: 'auto',
            display: 'flex',
            flexDirection: orientation === 'horizontal' ? 'row' : 'column',
            scrollbarWidth: 'none' // Hide scrollbars for clean UI
        });

        // 3. Next Button
        const nextButton = me.createElement('button', {
            className: 'ui-strip__scroll-btn ui-strip__scroll-btn--next',
            type: 'button'
        });
        nextButton.innerHTML = orientation === 'horizontal' ? '&#8250;' : '&#709;';
        me.updateStyles(nextButton, { display: 'none' }); // Hidden by default

        me.mount(stripElement, prevButton);
        me.mount(stripElement, viewport);
        me.mount(stripElement, nextButton);

        return stripElement;
    }

    /**
     * Updates the orientation classes and styles of the strip.
     *
     * @param {HTMLElement} element - The strip element.
     * @param {'horizontal'|'vertical'} orientation - The new orientation.
     * @returns {void}
     */
    updateOrientation(element, orientation) {
        const me = this;
        if (!element) return;

        // Remove old classes
        element.classList.remove('ui-strip--horizontal', 'ui-strip--vertical');
        element.classList.add(`ui-strip--${orientation}`);

        me.updateStyles(element, {
            flexDirection: orientation === 'horizontal' ? 'row' : 'column'
        });

        const viewport = me.getScrollContainer(element);
        if (viewport) {
            me.updateStyles(viewport, {
                flexDirection: orientation === 'horizontal' ? 'row' : 'column'
            });
        }

        const prevButton = me.getScrollButton(element, 'prev');
        const nextButton = me.getScrollButton(element, 'next');

        if (prevButton) {
            prevButton.innerHTML = orientation === 'horizontal' ? '&#8249;' : '&#708;';
        }
        if (nextButton) {
            nextButton.innerHTML = orientation === 'horizontal' ? '&#8250;' : '&#709;';
        }
    }

    /**
     * Mounts an item element into the strip's viewport.
     *
     * @param {HTMLElement} stripElement - The strip element.
     * @param {HTMLElement} itemElement - The item element to insert.
     * @param {number} [index=null] - The index to insert at.
     * @returns {void}
     */
    mountItem(stripElement, itemElement, index = null) {
        const me = this;
        const viewport = me.getScrollContainer(stripElement);
        if (!viewport || !itemElement) return;

        if (index === null || index >= viewport.childElementCount) {
            viewport.appendChild(itemElement);
        } else {
            const referenceNode = viewport.children[index];
            viewport.insertBefore(itemElement, referenceNode);
        }
    }

    /**
     * Unmounts an item element from the strip.
     *
     * @param {HTMLElement} stripElement - The strip element.
     * @param {HTMLElement} itemElement - The item element to remove.
     * @returns {void}
     */
    unmountItem(stripElement, itemElement) {
        const me = this;
        const viewport = me.getScrollContainer(stripElement);
        if (viewport && itemElement && viewport.contains(itemElement)) {
            me.unmount(viewport, itemElement);
        }
    }

    /**
     * Retrieves the scroll container (viewport) from the strip.
     *
     * @param {HTMLElement} stripElement - The strip element.
     * @returns {HTMLElement|null} The viewport element.
     */
    getScrollContainer(stripElement) {
        if (!stripElement) return null;
        return stripElement.querySelector('.ui-strip__viewport');
    }

    /**
     * Retrieves a scroll button by type.
     *
     * @param {HTMLElement} stripElement - The strip element.
     * @param {'prev'|'next'} type - The button type.
     * @returns {HTMLElement|null} The button element.
     */
    getScrollButton(stripElement, type) {
        if (!stripElement) return null;
        return stripElement.querySelector(`.ui-strip__scroll-btn--${type}`);
    }

    /**
     * Sets the visibility of the scroll buttons.
     *
     * @param {HTMLElement} stripElement - The strip element.
     * @param {boolean} showPrev - Whether to show the previous button.
     * @param {boolean} showNext - Whether to show the next button.
     * @returns {void}
     */
    setScrollButtonsVisibility(stripElement, showPrev, showNext) {
        const me = this;
        const prevBtn = me.getScrollButton(stripElement, 'prev');
        const nextBtn = me.getScrollButton(stripElement, 'next');

        if (prevBtn) {
            me.updateStyles(prevBtn, { display: showPrev ? '' : 'none' });
        }
        if (nextBtn) {
            me.updateStyles(nextBtn, { display: showNext ? '' : 'none' });
        }
    }

    /**
     * Performs scrolling on the viewport.
     *
     * @param {HTMLElement} stripElement - The strip element.
     * @param {'horizontal'|'vertical'} orientation - The orientation.
     * @param {number} amount - The amount to scroll (positive or negative).
     * @returns {void}
     */
    scroll(stripElement, orientation, amount) {
        const me = this;
        const viewport = me.getScrollContainer(stripElement);
        if (!viewport) return;

        const options = { behavior: 'smooth' };
        if (orientation === 'horizontal') {
            options.left = amount;
        } else {
            options.top = amount;
        }

        if (typeof viewport.scrollBy === 'function') {
            viewport.scrollBy(options);
        } else {
            // Fallback for older environments or tests
            if (orientation === 'horizontal') {
                viewport.scrollLeft += amount;
            } else {
                viewport.scrollTop += amount;
            }
        }
    }

    /**
     * Retrieves the current scroll dimensions of the viewport.
     *
     * @param {HTMLElement} stripElement - The strip element.
     * @returns {object|null} Object containing scrollTop, scrollLeft, scrollWidth, scrollHeight, clientWidth, clientHeight.
     */
    getScrollDimensions(stripElement) {
        const me = this;
        const viewport = me.getScrollContainer(stripElement);
        if (!viewport) return null;

        return {
            scrollTop: viewport.scrollTop,
            scrollLeft: viewport.scrollLeft,
            scrollWidth: viewport.scrollWidth,
            scrollHeight: viewport.scrollHeight,
            clientWidth: viewport.clientWidth,
            clientHeight: viewport.clientHeight
        };
    }

    /**
     * Starts observing the strip for resize events.
     *
     * @param {HTMLElement} stripElement - The strip element.
     * @param {Function} callback - The callback to execute on resize.
     * @returns {void}
     */
    observeResize(stripElement, callback) {
        const me = this;
        if (!stripElement || typeof callback !== 'function') return;

        // Clean up existing observer if any
        me.unobserveResize(stripElement);

        const observer = new ResizeObserver(() => {
            callback();
        });
        observer.observe(stripElement);
        // Also observe the viewport as content changes might affect scroll width without changing strip size
        const viewport = me.getScrollContainer(stripElement);
        if (viewport) {
            observer.observe(viewport);
        }

        me._resizeObservers.set(stripElement, observer);
    }

    /**
     * Stops observing the strip for resize events.
     *
     * @param {HTMLElement} stripElement - The strip element.
     * @returns {void}
     */
    unobserveResize(stripElement) {
        const me = this;
        if (!stripElement) return;

        const observer = me._resizeObservers.get(stripElement);
        if (observer) {
            observer.disconnect();
            me._resizeObservers.delete(stripElement);
        }
    }
}
