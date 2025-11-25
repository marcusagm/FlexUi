import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering Row components in a Vanilla JS environment.
 * It extends the generic VanillaRenderer to encapsulate the creation and manipulation
 * of the row structure, handling complex height logic, collapse states, and
 * the collapse trigger button.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaRowAdapter();
 * const rowElement = adapter.createRowElement('row-1');
 * const btn = adapter.createCollapseButton();
 * adapter.mountCollapseButton(rowElement, btn);
 * adapter.updateHeight(rowElement, 200, 100, false, false);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces .row CSS class structure.
 * - Manages complex flex/height styles based on collapse/last status.
 * - Handles visual states for the collapse button.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaRowAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaRowAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM element for a Row.
     *
     * @param {string} id - The unique ID of the row.
     * @returns {HTMLElement} The root row element.
     * @throws {Error} If the ID is invalid.
     */
    createRowElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(`[VanillaRowAdapter] Invalid id: "${id}". Must be a non-empty string.`);
        }

        const element = me.createElement('div', {
            className: 'row',
            id: `row-${id}`
        });

        return element;
    }

    /**
     * Creates the collapse button element.
     *
     * @returns {HTMLElement} The created button element.
     */
    createCollapseButton() {
        const me = this;
        const button = me.createElement('button', {
            className: 'row__collapse-btn',
            type: 'button'
        });
        button.setAttribute('aria-label', 'Toggle Row Collapse');
        return button;
    }

    /**
     * Updates the height and flex styles of the row based on its state.
     *
     * @param {HTMLElement} element - The row element.
     * @param {number|null} height - The target height in pixels.
     * @param {number} minHeight - The minimum height in pixels.
     * @param {boolean} isCollapsed - Whether the row is collapsed.
     * @param {boolean} isLast - Whether this is the last row in the container.
     * @returns {void}
     */
    updateHeight(element, height, minHeight, isCollapsed, isLast) {
        const me = this;
        if (!(element instanceof HTMLElement)) {
            console.warn(`[VanillaRowAdapter] Invalid element provided to updateHeight.`);
            return;
        }

        const styles = {};

        // Always set min-height base first (can be overridden below)
        const minH = Number(minHeight);
        if (!Number.isNaN(minH) && minH >= 0) {
            styles.minHeight = `${minH}px`;
        }

        if (isCollapsed) {
            element.classList.add('row--collapsed');
            styles.flex = '0 0 auto';
            styles.height = 'auto';
            styles.minHeight = 'auto';
        } else {
            element.classList.remove('row--collapsed');

            if (isLast) {
                styles.flex = '1 1 auto';
                // Reset explicit height if it was set, to allow flex grow
                // We cannot "unset" via object easily without checking current style,
                // but setting to '' (empty string) removes inline style in updateStyles via removeProperty usually,
                // or we can handle it here if updateStyles supports it.
                // The base renderer's updateStyles removes property if value is null/undefined.
                // Let's assume passing specific values overrides previous.
                // Ideally we want to remove 'height'.
                // Since VanillaRenderer.updateStyles doesn't strictly remove on empty string,
                // we pass null for removal.
                styles.height = null;
            } else if (height !== null && height !== undefined) {
                const hNum = Number(height);
                if (!Number.isNaN(hNum) && hNum >= 0) {
                    styles.flex = `0 0 ${hNum}px`;
                    // We don't necessarily set height=px if flex-basis handles it,
                    // but row logic often implies it. Standard flex-basis is enough.
                } else {
                    styles.flex = '1 1 auto';
                }
            } else {
                styles.flex = '1 1 auto';
            }
        }

        me.updateStyles(element, styles);
    }

    /**
     * Updates the visual state of the collapse button.
     *
     * @param {HTMLElement} btnElement - The button element.
     * @param {boolean} isCollapsed - Whether the row is collapsed.
     * @param {boolean} isDisabled - Whether the button is disabled.
     * @returns {void}
     */
    setCollapseButtonState(btnElement, isCollapsed, isDisabled) {
        if (!(btnElement instanceof HTMLElement)) return;

        if (isCollapsed) {
            btnElement.classList.add('row__collapse-btn--collapsed');
        } else {
            btnElement.classList.remove('row__collapse-btn--collapsed');
        }

        btnElement.disabled = !!isDisabled;

        // Optional: Update styles for disabled state if not handled by CSS :disabled
        if (isDisabled) {
            btnElement.style.display = 'none'; // Often hidden if disabled in layout logic
        } else {
            btnElement.style.display = '';
        }
    }

    /**
     * Mounts the collapse button into the row.
     *
     * @param {HTMLElement} rowElement - The row element.
     * @param {HTMLElement} btnElement - The button element.
     * @returns {void}
     */
    mountCollapseButton(rowElement, btnElement) {
        const me = this;
        if (!rowElement || !btnElement) return;
        me.mount(rowElement, btnElement);
    }

    /**
     * Unmounts the collapse button from its parent.
     *
     * @param {HTMLElement} btnElement - The button element.
     * @returns {void}
     */
    unmountCollapseButton(btnElement) {
        const me = this;
        if (!btnElement || !btnElement.parentNode) return;
        me.unmount(btnElement.parentNode, btnElement);
    }
}
