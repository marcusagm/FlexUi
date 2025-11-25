/**
 * Description:
 * A utility class designed to track lifecycle objects (like event listeners or disposables)
 * and detect potential memory leaks by identifying objects that have not been disposed of.
 * It works by registering objects upon creation with a stack trace, and requiring explicit
 * removal upon disposal.
 *
 * Properties summary:
 * - _registry {Map<object, string>} : Stores registered references mapped to their creation stack traces.
 * - _instance {LeakageMonitor | null} : The private static instance.
 *
 * Typical usage:
 * const monitor = LeakageMonitor.getInstance();
 * monitor.add(myListener, new Error().stack);
 * // ... later ...
 * monitor.delete(myListener);
 * // ... debug ...
 * monitor.check();
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Active only when `window.FLEXUI_DEBUG` is true (checked dynamically).
 * - Stores stack traces to help locate the source of the leak.
 * - Logs warnings to the console for any object remaining in the registry during a check.
 *
 * Dependencies:
 * - None
 */
export class LeakageMonitor {
    /**
     * The private static instance.
     *
     * @type {LeakageMonitor | null}
     * @private
     */
    static _instance = null;

    /**
     * Stores registered references mapped to their creation stack traces.
     *
     * @type {Map<object, string>}
     * @private
     */
    _registry = new Map();

    /**
     * Creates an instance of LeakageMonitor.
     * Private constructor for Singleton pattern.
     */
    constructor() {
        if (LeakageMonitor._instance) {
            return LeakageMonitor._instance;
        }
        LeakageMonitor._instance = this;
    }

    /**
     * Gets the singleton instance of the LeakageMonitor.
     *
     * @returns {LeakageMonitor} The singleton instance.
     */
    static getInstance() {
        if (!LeakageMonitor._instance) {
            LeakageMonitor._instance = new LeakageMonitor();
        }
        return LeakageMonitor._instance;
    }

    /**
     * Registers a reference to be tracked.
     *
     * @param {object|Function} reference - The object or function reference to track.
     * @param {string} [stackTrace] - Optional stack trace string. If omitted, one is generated.
     * @returns {void}
     */
    add(reference, stackTrace) {
        const me = this;

        // Check global debug flag to avoid overhead in production
        if (typeof window === 'undefined' || !window.FLEXUI_DEBUG) {
            return;
        }

        if (!reference || (typeof reference !== 'object' && typeof reference !== 'function')) {
            console.warn(
                `[LeakageMonitor] invalid reference assignment (${reference}). Reference must be an object or function.`
            );
            return;
        }

        if (me._registry.has(reference)) {
            return;
        }

        const trace = stackTrace || new Error('LeakageMonitor Registration').stack;
        me._registry.set(reference, trace);
    }

    /**
     * Removes a reference from tracking (marks it as disposed).
     *
     * @param {object|Function} reference - The object or function reference to remove.
     * @returns {void}
     */
    delete(reference) {
        const me = this;

        if (me._registry.size === 0) {
            return;
        }

        if (!reference || (typeof reference !== 'object' && typeof reference !== 'function')) {
            console.warn(
                `[LeakageMonitor] invalid reference assignment (${reference}). Reference must be an object or function.`
            );
            return;
        }

        if (me._registry.has(reference)) {
            me._registry.delete(reference);
        }
    }

    /**
     * Checks for potential leaks by listing all currently tracked references.
     * Logs findings to the console using console.group and console.warn.
     *
     * @returns {void}
     */
    check() {
        const me = this;
        const count = me._registry.size;

        if (count === 0) {
            console.info('[LeakageMonitor] No leaks detected. Registry is empty.');
            return;
        }

        console.group(`[LeakageMonitor] Detected ${count} potential leaks:`);

        me._registry.forEach((trace, ref) => {
            console.warn('Leaked Reference:', ref);
            console.groupCollapsed('Allocation Stack Trace');
            console.log(trace);
            console.groupEnd();
        });

        console.groupEnd();
    }

    /**
     * Clears the entire registry manually.
     *
     * @returns {void}
     */
    clear() {
        this._registry.clear();
    }
}
