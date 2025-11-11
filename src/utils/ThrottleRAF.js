/**
 * Description:
 * Creates a throttled function that only invokes 'func' at most once per
 * animation frame (using requestAnimationFrame).
 *
 * This is the ideal way to throttle continuous events that update the UI,
 * such as 'mousemove' (during resizing) or 'scroll'.
 *
 * @param {Function} func - The function to throttle.
 * @returns {Function & {cancel: Function}} Returns the new throttled function
 * which also includes a .cancel() method.
 */
export const throttleRAF = func => {
    /**
     * @type {number | null}
     */
    let rafId = null;
    let context = null;
    let args = null;

    /**
     * The function that runs inside the animation frame.
     */
    const runScheduled = () => {
        rafId = null;
        if (func && typeof func.apply === 'function') {
            func.apply(context, args);
        }
        context = null;
        args = null;
    };

    /**
     * The throttled function wrapper.
     */
    const throttled = function (...latestArgs) {
        context = this;
        args = latestArgs;

        if (rafId) {
            return;
        }

        rafId = requestAnimationFrame(runScheduled);
    };

    /**
     * Cancels the pending animation frame.
     * @returns {void}
     */
    throttled.cancel = () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
        }
        rafId = null;
        context = null;
        args = null;
    };

    return throttled;
};
