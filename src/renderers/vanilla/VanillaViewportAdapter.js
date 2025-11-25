import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering the Viewport component in a Vanilla JS environment.
 * It manages the DOM structure for the Multiple Document Interface (MDI) area,
 * creating specific slots for the tab bar (document navigation) and the content area
 * (where floating windows reside).
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaViewportAdapter();
 * const viewportEl = adapter.createViewportElement('main-viewport');
 * const tabSlot = adapter.getTabContainerSlot(viewportEl);
 * adapter.setTabBarVisible(viewportEl, true);
 * adapter.setFillSpace(viewportEl, true);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces a flex column layout to stack tabs above content.
 * - Manages visibility of the tab bar slot.
 * - Provides utility for batch z-index updates on window elements.
 * - Manages 'fills-space' modifier.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaViewportAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaViewportAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM structure for the Viewport.
     *
     * @param {string} id - The unique ID of the viewport.
     * @returns {HTMLElement} The root viewport element.
     * @throws {Error} If the ID is invalid.
     */
    createViewportElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaViewportAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const viewportElement = me.createElement('div', {
            className: 'viewport',
            id: `viewport-${id}`
        });

        // 1. Tab Bar Slot
        const tabBarSlot = me.createElement('div', {
            className: 'viewport__tab-bar-slot'
        });
        me.updateStyles(tabBarSlot, {
            flexShrink: '0',
            display: 'flex',
            flexDirection: 'column'
        });

        // 2. Content Area (Floating Windows Context)
        const contentElement = me.createElement('div', {
            className: 'viewport__content'
        });
        me.updateStyles(contentElement, {
            flexGrow: '1',
            position: 'relative',
            overflow: 'hidden'
        });

        me.mount(viewportElement, tabBarSlot);
        me.mount(viewportElement, contentElement);

        return viewportElement;
    }

    /**
     * Retrieves the slot element where the TabStrip should be mounted.
     *
     * @param {HTMLElement} element - The root viewport element.
     * @returns {HTMLElement|null} The tab bar slot element.
     */
    getTabContainerSlot(element) {
        if (!element) return null;
        return element.querySelector('.viewport__tab-bar-slot');
    }

    /**
     * Retrieves the content container where floating windows are appended.
     *
     * @param {HTMLElement} element - The root viewport element.
     * @returns {HTMLElement|null} The content container element.
     */
    getContentContainer(element) {
        if (!element) return null;
        return element.querySelector('.viewport__content');
    }

    /**
     * Toggles the visibility of the tab bar slot.
     *
     * @param {HTMLElement} element - The root viewport element.
     * @param {boolean} visible - True to show, false to hide.
     * @returns {void}
     */
    setTabBarVisible(element, visible) {
        const me = this;
        const slot = me.getTabContainerSlot(element);
        if (!slot) return;

        if (visible) {
            me.updateStyles(slot, { display: '' });
            element.classList.remove('viewport--tabs-hidden');
        } else {
            me.updateStyles(slot, { display: 'none' });
            element.classList.add('viewport--tabs-hidden');
        }
    }

    /**
     * Sets whether the viewport should fill the available space.
     *
     * @param {HTMLElement} element - The viewport element.
     * @param {boolean} fillsSpace - True to fill space.
     * @returns {void}
     */
    setFillSpace(element, fillsSpace) {
        if (!element) return;

        if (fillsSpace) {
            element.classList.add('viewport--fills-space');
        } else {
            element.classList.remove('viewport--fills-space');
        }
    }

    /**
     * Updates the z-index of a list of window elements sequentially.
     *
     * @param {Array<HTMLElement>} windowElements - Array of DOM elements representing windows.
     * @param {number} baseIndex - The starting z-index value.
     * @returns {void}
     */
    updateZIndices(windowElements, baseIndex) {
        const me = this;
        if (!Array.isArray(windowElements)) {
            console.warn('[VanillaViewportAdapter] updateZIndices expects an array of elements.');
            return;
        }

        const baseNum = Number(baseIndex);
        if (Number.isNaN(baseNum)) {
            console.warn('[VanillaViewportAdapter] Invalid baseIndex. Must be a number.');
            return;
        }

        windowElements.forEach((el, index) => {
            if (el instanceof HTMLElement) {
                me.updateStyles(el, { zIndex: baseNum + index });
            }
        });
    }
}
