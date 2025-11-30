/**
 * Description:
 * A helper function that converts a simple function into a Disposable object.
 * Useful for converting event listener removal functions into tracking objects.
 *
 * @param {Function} callback - The cleanup function to be executed.
 * @returns {{ dispose: Function }} An object adhering to the Disposable interface.
 */
export function toDisposable(callback) {
    if (typeof callback !== 'function') {
        console.warn(
            `[toDisposable] invalid callback assignment (${callback}). Callback must be a function.`
        );
        return {
            dispose: () => {}
        };
    }
    return {
        dispose: callback
    };
}

/**
 * Description:
 * Abstract base class for managing the lifecycle of resources.
 * Implements the Disposable pattern to ensure that event listeners,
 * timers, and other resources are cleaned up correctly to prevent memory leaks.
 *
 * Properties summary:
 * - _isDisposed {boolean} : Tracks if the object has already been disposed.
 * - _disposables {Set<object>} : A collection of objects or functions to be disposed.
 *
 * Typical usage:
 * class MyComponent extends Disposable {
 * constructor() {
 * super();
 * const listener = someService.on('event', () => {});
 * this.addDisposable(listener);
 * }
 * }
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Allows registering items that have a .dispose() method.
 * - Ensures resources are disposed only once.
 * - Disposes resources in reverse order (LIFO) logic implicitly via Set iteration or explicitly if needed, though Set order is insertion order.
 * - Prevents adding resources to an already disposed object (disposes them immediately instead).
 *
 * Dependencies:
 * - None
 */
export class Disposable {
    /**
     * Tracks if the object has already been disposed.
     *
     * @type {boolean}
     * @private
     */
    _isDisposed = false;

    /**
     * A collection of objects to be disposed.
     *
     * @type {Set<{ dispose: Function }>}
     * @private
     */
    _disposables;

    /**
     * Creates an instance of Disposable.
     */
    constructor() {
        const me = this;
        me._disposables = new Set();
    }

    /**
     * Checks if the object is currently disposed.
     *
     * @returns {boolean} True if disposed, false otherwise.
     */
    get isDisposed() {
        return this._isDisposed;
    }

    /**
     * Registers a disposable object to be tracked by this instance.
     * If this instance is already disposed, the item is disposed immediately.
     *
     * @param {{ dispose: Function }} item - The item to track. Must implement a .dispose() method.
     * @returns {void}
     */
    addDisposable(item) {
        const me = this;
        // Validation: Object with dispose method
        if (!item || typeof item.dispose !== 'function') {
            console.warn(
                `[Disposable] invalid item argument (${item}). Item must be an object with a dispose method.`
            );
            return;
        }

        if (me._isDisposed) {
            console.warn(
                '[Disposable] Attempted to add a disposable to an already disposed object. Disposing item immediately.'
            );
            item.dispose();
            return;
        }

        me._disposables.add(item);
    }

    /**
     * Helper to create a Disposable from a DOM event listener.
     * Automatically handles addEventListener and returns a Disposable that calls removeEventListener.
     *
     * @param {EventTarget} target - The DOM element or EventTarget.
     * @param {string} type - The event name.
     * @param {Function} handler - The listener function.
     * @param {boolean|object} [options] - Options for addEventListener.
     * @returns {{ dispose: Function }} A Disposable object.
     */
    static fromEvent(target, type, handler, options) {
        if (!target || typeof target.addEventListener !== 'function') {
            console.warn(`[Disposable] Invalid target for event listener:`, target);
            return { dispose: () => {} };
        }
        if (typeof handler !== 'function') {
            console.warn(`[Disposable] Invalid handler for event listener.`);
            return { dispose: () => {} };
        }

        target.addEventListener(type, handler, options);

        return {
            dispose: () => {
                try {
                    target.removeEventListener(type, handler, options);
                } catch (e) {
                    console.warn(`[Disposable] Error removing event listener:`, e);
                }
            }
        };
    }

    /**
     * Disposes all registered resources and marks this object as disposed.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me._isDisposed) {
            return;
        }

        me._isDisposed = true;

        me._disposables.forEach(item => {
            try {
                item.dispose();
            } catch (error) {
                console.error('[Disposable] Error while disposing item:', error);
            }
        });

        me._disposables.clear();
    }
}

/**
 * Description:
 * A concrete implementation of Disposable designed to hold a collection of
 * disposable items. It is useful when you need a container for disposables
 * without creating a new class hierarchy.
 *
 * Properties summary:
 * - (Inherits properties from Disposable)
 *
 * Typical usage:
 * const composite = new CompositeDisposable();
 * composite.add(disposable1);
 * composite.add(disposable2);
 * // ... later
 * composite.dispose();
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Accepts multiple arguments in constructor for convenience.
 * - Provides an alias method 'add' for addDisposable.
 *
 * Dependencies:
 * - Disposable
 */
/**
 * Description:
 * A concrete implementation of Disposable designed to hold a collection of
 * disposable items. It is useful when you need a container for disposables
 * without creating a new class hierarchy.
 *
 * Properties summary:
 * - _disposables {Array<{ dispose: Function }>} : A collection of objects to be disposed.
 *
 * Typical usage:
 * const composite = new CompositeDisposable();
 * composite.add(disposable1);
 * composite.add(disposable2);
 * // ... later
 * composite.dispose();
 *
 * Events:
 * - None
 *
 * Business rules implemented:
 * - Accepts multiple arguments in constructor for convenience.
 * - Uses an Array for storage to allow adding multiple items easily.
 * - Disposes all items in the array when dispose() is called.
 *
 * Dependencies:
 * - Disposable
 */
export class CompositeDisposable extends Disposable {
    /**
     * A collection of objects to be disposed.
     * Overrides the Set from the base class with an Array for this specific implementation.
     *
     * @type {Array<{ dispose: Function }>}
     * @private
     */
    _disposables = [];

    /**
     * Creates an instance of CompositeDisposable.
     *
     * @param {...{ dispose: Function }} items - Optional initial items to track.
     */
    constructor(...items) {
        super();
        const me = this;
        // We don't use the base class _disposables Set here, we use our own Array.
        // But we still call super() to initialize the base class state (like _isDisposed).
        if (items.length > 0) {
            me.add(...items);
        }
    }

    /**
     * Adds one or more disposable items to the collection.
     *
     * @param {...{ dispose: Function }} items - The items to track.
     * @returns {void}
     */
    add(...items) {
        const me = this;
        if (me.isDisposed) {
            items.forEach(item => {
                if (item && typeof item.dispose === 'function') {
                    item.dispose();
                }
            });
            return;
        }

        items.forEach(item => {
            if (item && typeof item.dispose === 'function') {
                me._disposables.push(item);
            } else {
                console.warn(
                    `[CompositeDisposable] invalid item added. Must have a dispose method.`,
                    item
                );
            }
        });
    }

    /**
     * Alias for add to maintain compatibility with Disposable interface if needed.
     *
     * @param {{ dispose: Function }} item - The item to track.
     * @returns {void}
     */
    addDisposable(item) {
        this.add(item);
    }

    /**
     * Disposes all registered resources and marks this object as disposed.
     *
     * @returns {void}
     */
    dispose() {
        const me = this;
        if (me.isDisposed) {
            return;
        }

        // Manually mark as disposed since we cannot call super.dispose()
        // because it attempts to call .clear() on _disposables which is now an Array.
        me._isDisposed = true;

        // Dispose our array items
        me._disposables.forEach(item => {
            try {
                item.dispose();
            } catch (error) {
                console.error('[CompositeDisposable] Error while disposing item:', error);
            }
        });

        me._disposables = [];
    }
}
