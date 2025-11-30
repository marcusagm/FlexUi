import { TokenNormalizer } from './TokenNormalizer.js';
import { Event } from '../../utils/Event.js';
import { stateManager } from '../StateManager.js';

/**
 * Description:
 * Receives canonical token objects and orchestrates matching against the registry.
 * It handles prioritization, sequence buffering, chord detection, scope filtering
 * (via StateManager), and dispatches actions via Event (command)
 * or direct callback (handler).
 *
 * Properties summary:
 * - _registry {ShortcutRegistry} : The registry instance.
 * - _sequenceBuffer {Array<object>} : Holds tokens for sequence matching.
 * - _sequenceTimer {number|null} : The setTimeout ID for clearing the buffer.
 * - _sequenceTimeout {number} : Milliseconds to wait for next key in sequence.
 * - _pressedKeys {Set<string>} : Set of canonical key IDs currently held down.
 * - _dispatchedChords {Set<string>} : Cache to prevent chord repetition on key hold.
 *
 * Typical usage:
 * // Instantiated by ShortcutService
 * const dispatcher = new ShortcutDispatcher({ registry });
 * dispatcher.handleToken(tokenObj, event, meta);
 *
 * Dependencies:
 * - ./TokenNormalizer.js
 * - ../../utils/Event.js
 * - ../StateManager.js
 */
export class ShortcutDispatcher {
    /**
     * The registry instance.
     * @type {import('./ShortcutRegistry.js').ShortcutRegistry}
     * @private
     */
    _registry = null;

    /**
     * Holds tokens for sequence matching.
     * @type {Array<object>}
     * @private
     */
    _sequenceBuffer = [];

    /**
     * The setTimeout ID for clearing the buffer.
     * @type {number|null}
     * @private
     */
    _sequenceTimer = null;

    /**
     * Milliseconds to wait for next key in sequence.
     * @type {number}
     * @private
     */
    _sequenceTimeout = 800;

    /**
     * Set of canonical key IDs currently held down (for chords).
     * @type {Set<string>}
     * @private
     */
    _pressedKeys = new Set();

    /**
     * Cache to prevent chord repetition on key hold.
     * @type {Set<string>}
     * @private
     */
    _dispatchedChords = new Set();

    /**
     * Description:
     * Creates an instance of the ShortcutDispatcher.
     *
     * @param {object} options - Configuration options.
     * @param {import('./ShortcutRegistry.js').ShortcutRegistry} options.registry - The registry instance.
     * @param {number} [options.sequenceTimeout=800] - Timeout in ms.
     */
    constructor({ registry, sequenceTimeout = 800 } = {}) {
        if (!registry) {
            throw new TypeError('ShortcutDispatcher requires a valid ShortcutRegistry instance.');
        }
        const me = this;
        me._registry = registry;
        me.sequenceTimeout = sequenceTimeout;
    }

    /**
     * <sequenceTimeout> getter.
     *
     * @returns {number} The current sequence timeout in ms.
     */
    get sequenceTimeout() {
        return this._sequenceTimeout;
    }

    /**
     * <sequenceTimeout> setter with validation.
     *
     * @param {number} value - Milliseconds to wait for next key in sequence.
     * @returns {void}
     */
    set sequenceTimeout(value) {
        const me = this;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 100) {
            console.warn(
                `[ShortcutDispatcher] invalid sequenceTimeout assignment (${value}). Must be >= 100. Keeping previous: ${me._sequenceTimeout}`
            );
            return;
        }
        me._sequenceTimeout = num;
    }

    /**
     * Description:
     * The main entry point. Handles an incoming normalized token, finds matches
     * in the registry, and dispatches the highest priority match.
     *
     * @param {object} tokenObj - The canonical token object from TokenNormalizer.
     * @param {Event|null} [event=null] - The native DOM event, if any.
     * @param {object} [meta={}] - Additional metadata (e.g., { gesture: 'pinch' }).
     * @returns {boolean} True if a shortcut was dispatched, false otherwise.
     */
    handleToken(tokenObj, event = null, meta = {}) {
        const me = this;
        if (!tokenObj) {
            return false;
        }

        if (tokenObj.kind === 'keyboard') {
            const cid = TokenNormalizer.canonicalKeyIdFromInput(tokenObj.id);
            me._pressedKeys.add(String(cid));
        }

        me._pushSequence(tokenObj);

        const activeScopes = stateManager.get('activeScopes') || [];
        const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
        const candidates = [];

        for (const def of me._registry.list()) {
            if (def.scopes && def.scopes.length > 0) {
                const intersects = def.scopes.some(s => activeScopes.includes(s));
                if (!intersects) {
                    continue;
                }
            }

            try {
                if (!def.enabledWhen || !def.enabledWhen({})) {
                    continue;
                }
            } catch (e) {
                continue;
            }

            if (def.context && typeof def.context === 'function') {
                try {
                    if (!def.context(activeElement, event)) {
                        continue;
                    }
                } catch (e) {
                    continue;
                }
            }
            candidates.push(def);
        }

        const matches = [];
        const seqCandidate = me._sequenceBuffer.concat([tokenObj]);

        for (const def of candidates) {
            if (def.chord && Array.isArray(def.chord)) {
                const needAll = def.chord.map(k => String(k));
                const hasAll = needAll.every(k => me._pressedKeys.has(String(k)));
                if (hasAll) {
                    matches.push({ def: def, kind: 'chord' });
                    continue;
                }
            }
            if (def.tokens && def.tokens.length > 0) {
                let ok = true;
                const tail = seqCandidate.slice(-def.tokens.length);
                if (tail.length < def.tokens.length) {
                    ok = false;
                } else {
                    for (let i = 0; i < def.tokens.length; i += 1) {
                        if (!TokenNormalizer.tokenEquals(def.tokens[i], tail[i])) {
                            ok = false;
                            break;
                        }
                    }
                }
                if (ok) {
                    matches.push({ def: def, kind: 'sequence' });
                    continue;
                }
            }
            if (def.keys && typeof def.keys === 'object' && def.keys.gesture) {
                if (
                    meta &&
                    meta.gesture &&
                    String(meta.gesture).toLowerCase() === String(def.keys.gesture).toLowerCase()
                ) {
                    matches.push({ def: def, kind: 'gesture' });
                    continue;
                }
            }
            if (typeof def.keys === 'string') {
                const tokenId = tokenObj.id || tokenObj;
                if (String(def.keys).toLowerCase() === String(tokenId).toLowerCase()) {
                    matches.push({ def: def, kind: 'token' });
                }
            }
        }

        if (matches.length === 0) {
            return false;
        }

        matches.sort((a, b) => {
            let sa;
            if (a.kind === 'chord') {
                sa = 1000;
            } else if (a.def.tokens) {
                sa = a.def.tokens.length;
            } else {
                sa = 1;
            }

            let sb;
            if (b.kind === 'chord') {
                sb = 1000;
            } else if (b.def.tokens) {
                sb = b.def.tokens.length;
            } else {
                sb = 1;
            }

            if (sb !== sa) {
                return sb - sa;
            }
            return b.def.priority - a.def.priority;
        });

        const chosen = matches[0].def;

        if (matches[0].kind === 'chord') {
            if (me._dispatchedChords.has(chosen.id)) {
                return false;
            }
            me._dispatchedChords.add(chosen.id);
        }

        try {
            if (chosen.preventDefault && event && typeof event.preventDefault === 'function') {
                try {
                    event.preventDefault();
                } catch (e) {
                    /* ignore */
                }
            }

            const payload = {
                shortcutDef: chosen,
                sequence: me._sequenceBuffer.slice(),
                meta: meta
            };

            if (chosen.command && typeof chosen.command === 'string') {
                Event.emit(chosen.command, payload);
            } else if (typeof chosen.handler === 'function') {
                chosen.handler(event, payload);
            }
        } catch (err) {
            console.error(`[ShortcutDispatcher] handler error for ${chosen.id}:`, err);
        }
        return true;
    }

    /**
     * Description:
     * Called by the service when a key is released to clear pressedKey
     * state (for chords) and reset the chord deduplication cache.
     *
     * @param {string|object} keyInput - The raw key input from the 'keyup' event.
     * @returns {void}
     */
    keyUp(keyInput) {
        const me = this;
        const cid = TokenNormalizer.canonicalKeyIdFromInput(keyInput);
        me._pressedKeys.delete(String(cid));
        me._dispatchedChords.clear();
    }

    /**
     * Description:
     * Pushes a token to the sequence buffer and resets the buffer timeout.
     *
     * @param {object} tokenObj - The canonical token object.
     * @private
     * @returns {void}
     */
    _pushSequence(tokenObj) {
        const me = this;
        me._sequenceBuffer.push(tokenObj);
        const maxLen = me._maxShortcutTokenLength();
        if (me._sequenceBuffer.length > maxLen) {
            me._sequenceBuffer.splice(0, me._sequenceBuffer.length - maxLen);
        }
        if (me._sequenceTimer) {
            clearTimeout(me._sequenceTimer);
            me._sequenceTimer = null;
        }
        me._sequenceTimer = setTimeout(() => {
            me._sequenceBuffer = [];
            me._sequenceTimer = null;
        }, me._sequenceTimeout);
    }

    /**
     * Description:
     * Finds the maximum sequence length in the registry (for buffer optimization).
     *
     * @private
     * @returns {number} The maximum token length.
     */
    _maxShortcutTokenLength() {
        const me = this;
        let max = 1;
        for (const def of me._registry.list()) {
            if (def.tokens && def.tokens.length > max) {
                max = def.tokens.length;
            }
        }
        return max;
    }

    /**
     * Description:
     * Disposes the dispatcher and clears all transient state.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me._sequenceTimer) {
            clearTimeout(me._sequenceTimer);
        }
        me._sequenceBuffer = [];
        me._pressedKeys.clear();
        me._dispatchedChords.clear();
        me._registry = null;
    }
}
