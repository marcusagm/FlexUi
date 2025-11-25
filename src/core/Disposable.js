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
export class CompositeDisposable extends Disposable {
    /**
     * Creates an instance of CompositeDisposable.
     *
     * @param {...{ dispose: Function }} items - Optional initial items to track.
     */
    constructor(...items) {
        super();
        const me = this;
        items.forEach(item => me.addDisposable(item));
    }

    /**
     * Alias for addDisposable to improve readability when used as a container.
     *
     * @param {{ dispose: Function }} item - The item to track.
     * @returns {void}
     */
    add(item) {
        this.addDisposable(item);
    }
}
