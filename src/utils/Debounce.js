/**
 * Creates a debounced function that delays invoking 'func' until after 'delay'
 * milliseconds have elapsed since the last time the debounced function was
 * invoked.
 *
 * This version correctly handles the 'this' context of the caller and
 * provides an 'immediate' option for leading-edge execution.
 *
 * @param {function} func - The function to debounce.
 * @param {number} delay - The number of milliseconds to delay.
 * @param {boolean} [immediate=false] - (Req 11) Specify true to invoke 'func' on the
 * leading edge (immediately) instead of the trailing edge.
 * @returns {function} Returns the new debounced function.
 * @returns {function.cancel} The debounced function comes with a .cancel() method
 * to cancel any pending invocation.
 */
export const debounce = (func, delay, immediate = false) => {
    let timeoutId = null;
    let result;

    // Use a regular function to get its own 'this' context
    const debounced = function (...args) {
        // 'this' is the context of the caller (e.g., the App instance)
        const context = this;

        // Function to execute on the trailing edge
        const later = function () {
            timeoutId = null;
            if (!immediate) {
                result = func.apply(context, args);
            }
        };

        const callNow = immediate && !timeoutId;

        // Clear any pending timeout
        clearTimeout(timeoutId);
        // Set the new timeout
        timeoutId = setTimeout(later, delay);

        // If leading-edge, call immediately
        if (callNow) {
            result = func.apply(context, args);
        }

        return result;
    };

    /**
     * Cancels the pending debounced function invocation.
     */
    debounced.cancel = () => {
        clearTimeout(timeoutId);
        timeoutId = null;
    };

    return debounced;
};
