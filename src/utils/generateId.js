/**
 * Description:
 * Generates a simple, semi-unique ID string.
 * Uses crypto.randomUUID() if available, otherwise falls back
 * to a timestamp/random combination.
 *
 * Typical usage:
 * this.id = generateId();
 *
 * @returns {string} A semi-unique ID (e.g., "kde3o1p-..." or "shape_...").
 */
export const generateId = () => {
    const radix = 36,
        start = 2,
        length = 9;

    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `shape_${Date.now()}_${Math.random().toString(radix).slice(start, length)}`;
};
