import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Map of state properties to their corresponding CSS BEM modifiers.
 * @type {Object<string, string>}
 */
const STATE_CLASS_MAP = {
    maximized: 'application-window--maximized',
    minimized: 'application-window--minimized',
    focused: 'application-window--focused',
    pinned: 'application-window--pinned',
    tabbed: 'application-window--tabbed',
    activeTab: 'application-window--active-tab'
};

/**
 * Description:
 * A specialized adapter for rendering ApplicationWindow components in a Vanilla JS environment.
 * It extends the generic VanillaRenderer to encapsulate all DOM manipulations related to
 * window management, such as creation, geometry updates, state class toggling, and z-index management.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaWindowAdapter();
 * const windowElement = adapter.createWindowElement('win-1');
 * adapter.updateGeometry(windowElement, 10, 10, 400, 300);
 * adapter.updateStateClasses(windowElement, { focused: true, maximized: false });
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces the BEM structure for windows (.application-window, .application-window__content).
 * - Validates all inputs (elements, coordinates, dimensions) before applying styles.
 * - Manages the switch between absolute positioning (floating) and static positioning (tabbed).
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaWindowAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaWindowAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM structure for an ApplicationWindow.
     * Structure: <div class="application-window"> <div class="application-window__content"></div> </div>
     *
     * @param {string} id - The unique ID of the window.
     * @returns {HTMLElement} The root window element.
     * @throws {Error} If the ID is invalid.
     */
    createWindowElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaWindowAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        // Create root element
        const windowElement = me.createElement('div', {
            className: 'application-window',
            id: `window-${id}`
        });

        // Default to absolute positioning for floating windows
        me.updateStyles(windowElement, {
            position: 'absolute'
        });

        // Create content container
        const contentElement = me.createElement('div', {
            className: 'application-window__content'
        });

        // Default content styles
        me.updateStyles(contentElement, {
            overflow: 'auto',
            flex: '1',
            position: 'relative'
        });

        me.mount(windowElement, contentElement);

        return windowElement;
    }

    /**
     * Retrieves the content container element from the window wrapper.
     *
     * @param {HTMLElement} windowElement - The root window element.
     * @returns {HTMLElement|null} The content element or null if not found.
     */
    getContentElement(windowElement) {
        if (!windowElement || typeof windowElement.querySelector !== 'function') {
            console.warn(
                `[VanillaWindowAdapter] Invalid windowElement provided to getContentElement.`
            );
            return null;
        }
        return windowElement.querySelector('.application-window__content');
    }

    /**
     * Updates the position and size of the window element.
     * Only applies styles if values are valid numbers.
     *
     * @param {HTMLElement} element - The target window element.
     * @param {number} x - The X coordinate (left).
     * @param {number} y - The Y coordinate (top).
     * @param {number} width - The width in pixels.
     * @param {number} height - The height in pixels.
     * @returns {void}
     */
    updateGeometry(element, x, y, width, height) {
        const me = this;
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaWindowAdapter] invalid element assignment (${element}). Element must be an HTMLElement.`
            );
            return;
        }

        const xNum = Number(x);
        const yNum = Number(y);
        const wNum = Number(width);
        const hNum = Number(height);

        const styles = {};

        if (!Number.isNaN(xNum)) styles.left = `${xNum}px`;
        if (!Number.isNaN(yNum)) styles.top = `${yNum}px`;
        if (!Number.isNaN(wNum)) styles.width = `${wNum}px`;
        if (!Number.isNaN(hNum)) styles.height = `${hNum}px`;

        me.updateStyles(element, styles);
    }

    /**
     * Updates the CSS classes based on the window's logical state.
     *
     * @param {HTMLElement} element - The target window element.
     * @param {object} state - The state object.
     * @param {boolean} [state.maximized] - Whether the window is maximized.
     * @param {boolean} [state.minimized] - Whether the window is minimized.
     * @param {boolean} [state.focused] - Whether the window is focused.
     * @param {boolean} [state.pinned] - Whether the window is pinned (always on top).
     * @param {boolean} [state.tabbed] - Whether the window is tabbed (docked).
     * @param {boolean} [state.activeTab] - Whether the window is the active tab (visible).
     * @returns {void}
     */
    updateStateClasses(element, state = {}) {
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaWindowAdapter] invalid element assignment (${element}). Element must be an HTMLElement.`
            );
            return;
        }

        Object.keys(STATE_CLASS_MAP).forEach(key => {
            element.classList.toggle(STATE_CLASS_MAP[key], !!state[key]);
        });
    }

    /**
     * Updates the z-index of the window element.
     *
     * @param {HTMLElement} element - The target window element.
     * @param {number} zIndex - The new z-index value.
     * @returns {void}
     */
    updateZIndex(element, zIndex) {
        const me = this;
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaWindowAdapter] invalid element assignment (${element}). Element must be an HTMLElement.`
            );
            return;
        }

        const zNum = Number(zIndex);
        if (Number.isNaN(zNum)) {
            console.warn(
                `[VanillaWindowAdapter] invalid zIndex assignment (${zIndex}). Must be a number.`
            );
            return;
        }

        me.updateStyles(element, { zIndex: zNum });
    }

    /**
     * Toggles the window positioning mode between Tabbed (Flex) and Floating (Absolute).
     *
     * @param {HTMLElement} element - The target window element.
     * @param {boolean} isTabbed - True to enable tabbed mode, false for floating.
     * @returns {void}
     */
    setTabbedMode(element, isTabbed) {
        const me = this;
        if (!(element instanceof HTMLElement)) {
            console.warn(
                `[VanillaWindowAdapter] invalid element assignment (${element}). Element must be an HTMLElement.`
            );
            return;
        }

        if (isTabbed) {
            // Reset geometry styles to allow flexbox layout control
            me.updateStyles(element, {
                position: '', // Removes 'absolute'
                top: '',
                left: '',
                width: '',
                height: '',
                zIndex: ''
            });
        } else {
            // Restore absolute positioning for floating behavior
            // Note: Geometry values must be reapplied by the controller after this call
            me.updateStyles(element, {
                position: 'absolute'
            });
        }
    }

    /**
     * Mounts the header element into the window structure.
     * Ensures the header is always the first child.
     *
     * @param {HTMLElement} windowElement - The root window element.
     * @param {HTMLElement} headerElement - The header DOM element.
     * @returns {void}
     */
    mountHeader(windowElement, headerElement) {
        const me = this;
        if (!(windowElement instanceof HTMLElement) || !(headerElement instanceof HTMLElement)) {
            console.warn('[VanillaWindowAdapter] Invalid elements provided to mountHeader.');
            return;
        }

        if (windowElement.firstChild) {
            windowElement.insertBefore(headerElement, windowElement.firstChild);
        } else {
            me.mount(windowElement, headerElement);
        }
    }
}
