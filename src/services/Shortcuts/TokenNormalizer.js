/**
 * Description:
 * A pure static utility class for normalizing and comparing shortcut tokens.
 * It provides functions to convert various inputs (strings, objects, arrays)
 * into canonical token objects that the ShortcutDispatcher can understand.
 *
 * Properties summary:
 * - (Static Class)
 *
 * Typical usage:
 * const tokens = TokenNormalizer.normalizeKeysToObjects('Ctrl+S');
 * const isEqual = TokenNormalizer.tokenEquals(tokenA, tokenB);
 *
 * Dependencies:
 * - None
 *
 * Notes / Additional:
 * - This module is pure and has no side effects for easy unit testing.
 */
export class TokenNormalizer {
    /**
     * Normalizes the `keys` provided in registration into an array of canonical token objects.
     * Handles strings (space-separated), arrays, or single objects.
     *
     * @param {string|Array<string>|object} keys - The raw keys input to normalize.
     * @returns {Array<object>} An array of canonical token objects.
     * @static
     */
    static normalizeKeysToObjects(keys) {
        if (!keys) {
            return [];
        }
        if (Array.isArray(keys)) {
            return keys.map(k => TokenNormalizer.normalizeTokenToObject(k));
        }
        if (typeof keys === 'string') {
            return keys
                .split(/\s+/)
                .filter(Boolean)
                .map(k => TokenNormalizer.normalizeTokenToObject(k));
        }
        if (typeof keys === 'object') {
            return [TokenNormalizer.normalizeTokenToObject(keys)];
        }
        return [];
    }

    /**
     * Normalizes a single token (string or object) into a canonical token object.
     *
     * @param {string|object} token - The single token to normalize.
     * @returns {object} A standardized token object (e.g., { kind, id, raw, meta }).
     * @static
     */
    static normalizeTokenToObject(token) {
        if (token === null || token === undefined) {
            return token;
        }
        if (typeof token === 'object') {
            const t = Object.assign({}, token);
            if (t.gesture) {
                t.gesture = String(t.gesture).toLowerCase();
            }
            if (t.gesture) {
                return Object.freeze({
                    kind: 'gesture',
                    id: String(t.gesture).toLowerCase(),
                    raw: token,
                    meta: Object.assign({}, t)
                });
            }
            return Object.freeze({
                kind: 'object',
                id: JSON.stringify(t),
                raw: token,
                meta: Object.assign({}, t)
            });
        }
        const s = String(token).trim();
        if (/^\d+-finger-swipe-/i.test(s) || /^pinch$/i.test(s) || /^rotate$/i.test(s)) {
            return Object.freeze({ kind: 'gesture', id: s.toLowerCase(), raw: s });
        }
        if (/^Wheel(?:Up|Down)$/i.test(s)) {
            return Object.freeze({ kind: 'wheel', id: s, raw: s });
        }
        if (s.indexOf('+') !== -1) {
            if (/Click$/i.test(s) || /RightClick$/i.test(s) || /MiddleClick$/i.test(s)) {
                return Object.freeze({ kind: 'pointer', id: s, raw: s });
            }
            return Object.freeze({
                kind: 'keyboard',
                id: TokenNormalizer.canonicalizeKeyString(s),
                raw: s
            });
        }
        return Object.freeze({ kind: 'string', id: s, raw: s });
    }

    /**
     * Compares two normalized tokens (objects or strings) for equality.
     *
     * @param {string|object} a - The first token.
     * @param {string|object} b - The second token.
     * @returns {boolean} True if the tokens are considered equal.
     * @static
     */
    static tokenEquals(a, b) {
        if (a === b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        if (typeof a === 'object' && typeof b === 'object') {
            const ak = a.kind || null;
            const bk = b.kind || null;
            const aid = a.id || (a.raw ? String(a.raw) : null);
            const bid = b.id || (b.raw ? String(b.raw) : null);
            if (ak && bk && ak === bk && aid && bid) {
                return String(aid).toLowerCase() === String(bid).toLowerCase();
            }
            try {
                return JSON.stringify(a) === JSON.stringify(b);
            } catch (e) {
                return false;
            }
        }
        if (typeof a === 'string' && typeof b === 'string') {
            return a.toLowerCase() === b.toLowerCase();
        }
        return String(a).toLowerCase() === String(b).toLowerCase();
    }

    /**
     * Canonicalizes an incoming key string (e.g., 'ctrl+s') into a consistent
     * format (e.g., 'Ctrl+KeyS').
     *
     * @param {string|object} k - The key string or object to canonicalize.
     * @returns {string} The canonical string.
     * @static
     */
    static canonicalizeKeyString(k) {
        if (!k && k !== 0) {
            return String(k);
        }
        if (typeof k === 'object') {
            if (k.id) {
                return String(k.id);
            }
            return JSON.stringify(k);
        }
        const s = String(k).trim();
        const parts = s
            .split('+')
            .map(p => p.trim())
            .filter(Boolean);
        if (parts.length === 0) {
            return s;
        }
        const canonicalParts = parts.map((p, idx) => {
            if (idx === parts.length - 1) {
                if (
                    /^Key[A-Za-z0-9]+$/i.test(p) ||
                    /^Digit[0-9]+$/i.test(p) ||
                    /^Arrow(Left|Right|Up|Down)$/i.test(p) ||
                    /^Numpad/i.test(p) ||
                    /^F[0-9]+$/i.test(p)
                ) {
                    return p;
                }
                if (/^Code:/i.test(p) || /^Key:/i.test(p)) {
                    return p;
                }

                if (p.length === 1) {
                    const char = p.toUpperCase();
                    if (char >= 'A' && char <= 'Z') {
                        return `Key${char}`;
                    }
                    if (char >= '0' && char <= '9') {
                        return `Digit${char}`;
                    }
                }
                return p;
            }
            if (/^ctrl$/i.test(p)) {
                return 'Ctrl';
            }
            if (/^shift$/i.test(p)) {
                return 'Shift';
            }
            if (/^alt$/i.test(p)) {
                return 'Alt';
            }
            if (/^meta$/i.test(p) || /^cmd$/i.test(p) || /^win$/i.test(p)) {
                return 'Meta';
            }
            return p;
        });
        return canonicalParts.join('+');
    }

    /**
     * Builds a canonical key ID used inside the pressedKeys set (for chords).
     *
     * @param {string|object} k - The raw key input.
     * @returns {string} The canonical string ID.
     * @static
     */
    static canonicalKeyIdFromInput(k) {
        if (k === null || k === undefined) {
            return String(k);
        }
        if (typeof k === 'object') {
            if (k.id) {
                return String(k.id);
            }
            return JSON.stringify(k);
        }
        return TokenNormalizer.canonicalizeKeyString(String(k));
    }
}
