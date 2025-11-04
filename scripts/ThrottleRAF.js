/**
 * Creates a throttled function that only invokes 'func' at most once per
 * animation frame (using requestAnimationFrame).
 *
 * This is the ideal way to throttle continuous events that update the UI,
 * such as 'mousemove' (during resizing) or 'scroll'.
 *
 * @param {function} func - The function to throttle.
 * @returns {function} Returns the new throttled function.
 * @returns {function.cancel} The throttled function comes with a .cancel() method
 * to cancel any pending scheduled frame.
 */
export const throttleRAF = (func) => {
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
        rafId = null; // Clear the ID so a new frame can be scheduled
        if (func && typeof func.apply === 'function') {
            func.apply(context, args);
        }
        // Clear context and args
        context = null;
        args = null;
    };

    /**
     * The throttled function wrapper.
     */
    const throttled = function (...latestArgs) {
        // 'this' is the context of the caller (e.g., Column or PanelGroup)
        context = this;
        args = latestArgs;

        // If we already have a frame scheduled, don't schedule another.
        // The 'runScheduled' function will use the latest 'context' and 'args'.
        if (rafId) {
            return;
        }

        // Schedule the function to run on the next animation frame
        rafId = requestAnimationFrame(runScheduled);
    };

    /**
     * Cancels the pending animation frame.
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
