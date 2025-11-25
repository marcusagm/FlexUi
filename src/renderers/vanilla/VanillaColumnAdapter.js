import { VanillaRenderer } from './VanillaRenderer.js';

/**
 * Description:
 * A specialized adapter for rendering Column components in a Vanilla JS environment.
 * It extends the generic VanillaRenderer to encapsulate the creation and manipulation
 * of the column structure, specifically handling Flexbox sizing and constraints.
 *
 * Properties summary:
 * - None
 *
 * Typical usage:
 * const adapter = new VanillaColumnAdapter();
 * const columnElement = adapter.createColumnElement('col-1');
 * adapter.updateWidth(columnElement, 250); // Fixed width
 * adapter.setMinWidth(columnElement, 150);
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Enforces .column CSS class structure.
 * - Manages Flexbox 'flex' property for fixed vs fluid layouts.
 * - Applies minimum width constraints.
 *
 * Dependencies:
 * - {import('./VanillaRenderer.js').VanillaRenderer}
 */
export class VanillaColumnAdapter extends VanillaRenderer {
    /**
     * Creates an instance of VanillaColumnAdapter.
     */
    constructor() {
        super();
    }

    /**
     * Creates the main DOM element for a Column.
     *
     * @param {string} id - The unique ID of the column.
     * @returns {HTMLElement} The root column element.
     * @throws {Error} If the ID is invalid.
     */
    createColumnElement(id) {
        const me = this;
        if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
                `[VanillaColumnAdapter] Invalid id: "${id}". Must be a non-empty string.`
            );
        }

        const element = me.createElement('div', {
            className: 'column',
            id: `column-${id}`
        });

        return element;
    }

    /**
     * Updates the width (flex-basis) of the column.
     * If width is provided, it sets a fixed size.
     * If width is null/null, it sets the column to grow/shrink automatically.
     *
     * @param {HTMLElement} element - The column element.
     * @param {number|null} width - The width in pixels or null for auto.
     * @returns {void}
     */
    updateWidth(element, width) {
        const me = this;
        if (!(element instanceof HTMLElement)) {
            console.warn(`[VanillaColumnAdapter] Invalid element provided to updateWidth.`);
            return;
        }

        if (width !== null && width !== undefined) {
            const widthNum = Number(width);
            if (Number.isFinite(widthNum) && widthNum >= 0) {
                me.updateStyles(element, { flex: `0 0 ${widthNum}px` });
            } else {
                console.warn(
                    `[VanillaColumnAdapter] Invalid width: ${width}. Must be a positive number.`
                );
            }
        } else {
            // Fluid layout
            me.updateStyles(element, { flex: '1 1 auto' });
        }
    }

    /**
     * Updates the minimum width constraint of the column.
     *
     * @param {HTMLElement} element - The column element.
     * @param {number} minWidth - The minimum width in pixels.
     * @returns {void}
     */
    setMinWidth(element, minWidth) {
        const me = this;
        if (!(element instanceof HTMLElement)) {
            console.warn(`[VanillaColumnAdapter] Invalid element provided to setMinWidth.`);
            return;
        }

        const minWidthNum = Number(minWidth);
        if (Number.isFinite(minWidthNum) && minWidthNum >= 0) {
            me.updateStyles(element, { minWidth: `${minWidthNum}px` });
        } else {
            console.warn(
                `[VanillaColumnAdapter] Invalid minWidth: ${minWidth}. Must be a positive number.`
            );
        }
    }
}
