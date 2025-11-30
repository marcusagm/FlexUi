import { TokenNormalizer } from './TokenNormalizer.js';

/**
 * Description:
 * Manages shortcut definitions: register, unregister, edit, list.
 * Normalizes tokens, scopes, and context definitions upon registration
 * so other modules (like the Dispatcher) can rely on consistent shapes.
 *
 * Properties summary:
 * - _shortcuts {Map<string, object>} : The main store for shortcut definitions.
 * - _nextId {number} : A simple counter to generate unique shortcut IDs.
 *
 * Typical usage:
 * const registry = new ShortcutRegistry();
 * const id = registry.register(
 * { keys: 'Ctrl+S', command: 'app:save', scopes: ['global'] },
 * myHandlerFn
 * );
 * registry.unregister(id);
 *
 * Dependencies:
 * - ./TokenNormalizer.js
 */
export class ShortcutRegistry {
    /**
     * Stores the registered shortcuts, keyed by their generated ID.
     * @type {Map<string, object>}
     * @private
     */
    _shortcuts = new Map();

    /**
     * A simple counter to generate unique shortcut IDs.
     * @type {number}
     * @private
     */
    _nextId = 1;

    /**
     * Description:
     * Creates a new ShortcutRegistry instance.
     */
    constructor() {
        // intentionally lightweight
    }

    /**
     * Description:
     * Registers a new shortcut definition. Normalizes all inputs.
     *
     * @param {object} definition - The shortcut definition object.
     * @param {string|Array|object} definition.keys - The key(s) or gesture.
     * @param {string} [definition.command] - An optional command to emit on the Event service.
     * @param {string|Array<string>} [definition.scopes] - Scopes where this shortcut is active.
     * @param {string|Function} [definition.context] - A CSS selector string or a function.
     * @param {Function} [definition.enabledWhen] - A function that must return true.
     * @param {number} [definition.priority] - A priority number.
     * @param {Function} [handler] - The callback function to execute.
     * @returns {string} The unique ID of the registered shortcut.
     */
    register(definition, handler) {
        const me = this;
        if (!definition || typeof definition !== 'object') {
            throw new TypeError('ShortcutRegistry.register requires a definition object');
        }
        const id = `sc_${me._nextId++}`;
        const defClone = Object.assign({}, definition);
        defClone.id = id;
        defClone.handler = handler || defClone.handler || null;

        if (!defClone.handler && !defClone.command) {
            console.warn(
                `[ShortcutRegistry] Shortcut definition for "${defClone.keys}" has no 'handler' or 'command' and will do nothing.`
            );
        }

        // Scopes normalization
        if (!defClone.scopes) {
            defClone.scopes = [];
        } else if (typeof defClone.scopes === 'string') {
            defClone.scopes = [defClone.scopes];
        } else if (!Array.isArray(defClone.scopes)) {
            defClone.scopes = [];
        }

        // Tokens normalized to canonical objects
        defClone.tokens = TokenNormalizer.normalizeKeysToObjects(defClone.keys);

        // Chord normalized
        if (defClone.chord && Array.isArray(defClone.chord)) {
            defClone.chord = defClone.chord.map(k =>
                String(TokenNormalizer.canonicalKeyIdFromInput(k))
            );
        }

        // Context string -> function
        if (defClone.context && typeof defClone.context === 'string') {
            const selector = defClone.context;
            defClone.context = (activeElement, event) => {
                try {
                    return Boolean(
                        activeElement &&
                            typeof activeElement.matches === 'function' &&
                            activeElement.matches(selector)
                    );
                } catch (e) {
                    return false;
                }
            };
        }

        if (typeof defClone.enabledWhen !== 'function') {
            defClone.enabledWhen = () => true;
        }
        if (typeof defClone.priority !== 'number') {
            defClone.priority = 0;
        }

        me._shortcuts.set(id, defClone);
        return id;
    }

    /**
     * Description:
     * Unregisters a shortcut by its ID.
     *
     * @param {string} id - The ID returned by `register`.
     * @returns {void}
     */
    unregister(id) {
        if (!id) {
            return;
        }
        if (this._shortcuts.has(id)) {
            this._shortcuts.delete(id);
        }
    }

    /**
     * Description:
     * Edits properties of an existing shortcut and re-normalizes it.
     *
     * @param {string} id - The ID of the shortcut to edit.
     * @param {object} newProps - The new properties to merge.
     * @returns {void}
     */
    edit(id, newProps) {
        const me = this;
        if (!me._shortcuts.has(id)) {
            console.warn(`[ShortcutRegistry] invalid edit call (${id}). No such id.`);
            return;
        }
        if (!newProps || typeof newProps !== 'object') {
            console.warn(
                `[ShortcutRegistry] invalid edit assignment (${newProps}). newProps must be object.`
            );
            return;
        }
        const existing = Object.assign({}, me._shortcuts.get(id));
        const merged = Object.assign({}, existing, newProps, { id });
        me._shortcuts.delete(id);

        merged.handler = merged.handler || existing.handler || null;
        if (typeof merged.scopes === 'string') {
            merged.scopes = [merged.scopes];
        }
        merged.tokens = TokenNormalizer.normalizeKeysToObjects(merged.keys);
        if (merged.chord && Array.isArray(merged.chord)) {
            merged.chord = merged.chord.map(k =>
                String(TokenNormalizer.canonicalKeyIdFromInput(k))
            );
        }
        if (merged.context && typeof merged.context === 'string') {
            const selector = merged.context;
            merged.context = (activeElement, event) => {
                try {
                    return Boolean(
                        activeElement &&
                            typeof activeElement.matches === 'function' &&
                            activeElement.matches(selector)
                    );
                } catch (e) {
                    return false;
                }
            };
        }
        if (typeof merged.enabledWhen !== 'function') {
            merged.enabledWhen = () => true;
        }
        if (typeof merged.priority !== 'number') {
            merged.priority = 0;
        }

        me._shortcuts.set(id, merged);
    }

    /**
     * Description:
     * Gets a (cloned) copy of a shortcut definition by its ID.
     *
     * @param {string} id - The ID of the shortcut.
     * @returns {object|null} A clone of the definition, or null.
     */
    get(id) {
        if (!this._shortcuts.has(id)) {
            return null;
        }
        return Object.assign({}, this._shortcuts.get(id));
    }

    /**
     * Description:
     * Lists (cloned) copies of all registered shortcut definitions.
     *
     * @returns {Array<object>} An array of definition objects.
     */
    list() {
        const out = [];
        for (const def of this._shortcuts.values()) {
            out.push(Object.assign({}, def));
        }
        return out;
    }

    /**
     * Description:
     * Clears all shortcuts from the registry.
     *
     * @returns {void}
     */
    clear() {
        this._shortcuts.clear();
    }

    /**
     * Description:
     * Serializes the registry state to a JSON-friendly object.
     *
     * @returns {object} A serializable object.
     */
    toJSON() {
        return { shortcuts: this.list(), nextId: this._nextId };
    }

    /**
     * Description:
     * Recreates a registry instance from a JSON object (static method).
     *
     * @param {object} json - The object from `toJSON()`.
     * @returns {ShortcutRegistry} A new, hydrated registry instance.
     * @static
     */
    static fromJSON(json) {
        if (!json || typeof json !== 'object') {
            throw new TypeError('Invalid json for ShortcutRegistry.fromJSON');
        }
        const reg = new ShortcutRegistry();
        if (Array.isArray(json.shortcuts)) {
            for (const s of json.shortcuts) {
                const handler = s.handler || null;
                const temp = Object.assign({}, s);
                delete temp.id;
                temp.handler = handler;
                reg.register(temp, handler);
            }
        }
        if (Number.isFinite(json.nextId)) {
            reg._nextId = json.nextId;
        }
        return reg;
    }
}
