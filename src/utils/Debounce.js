/**
 * Description:
 * Creates a debounced function that delays invoking 'func' until after 'delay'
 * milliseconds have elapsed since the last time the debounced function was
 * invoked.
 *
 * This version correctly handles the 'this' context of the caller and
 * provides an 'immediate' option for leading-edge execution.
 *
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The number of milliseconds to delay.
 * @param {boolean} [immediate=false] - Specify true to invoke 'func' on the
 * leading edge (immediately) instead of the trailing edge.
 * @returns {Function & {cancel: Function}} Returns the new debounced function
 * which also includes a .cancel() method.
 */
export const debounce = (func, delay, immediate = false) => {
    let timeoutId = null;
    let result;

    const debounced = function (...args) {
        const context = this;

        const later = function () {
            timeoutId = null;
            if (!immediate) {
                result = func.apply(context, args);
            }
        };

        const callNow = immediate && !timeoutId;

        clearTimeout(timeoutId);
        timeoutId = setTimeout(later, delay);

        if (callNow) {
            result = func.apply(context, args);
        }

        return result;
    };

    /**
     * Cancels the pending debounced function invocation.
     * @returns {void}
     */
    debounced.cancel = () => {
        clearTimeout(timeoutId);
        timeoutId = null;
    };

    return debounced;
};
