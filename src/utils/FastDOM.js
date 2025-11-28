/**
 * Description:
 * A utility to batch DOM read/write operations to prevent Layout Thrashing.
 * It schedules 'measure' (read) tasks to run before 'mutate' (write) tasks
 * within a single animation frame.
 *
 * Typical usage:
 * FastDOM.measure(() => {
 *     const width = element.offsetWidth;
 *     FastDOM.mutate(() => {
 *         element.style.width = width + 'px';
 *     });
 * });
 *
 * Properties summary:
 * - _reads {Array<Function>} : Queue of read tasks.
 * - _writes {Array<Function>} : Queue of write tasks.
 * - _scheduled {boolean} : Whether a flush is scheduled.
 *
 * Dependencies:
 * - None
 */
export class FastDOM {
    /**
     * Queue of read tasks.
     * @type {Array<Function>}
     * @private
     */
    static _reads = [];

    /**
     * Queue of write tasks.
     * @type {Array<Function>}
     * @private
     */
    static _writes = [];

    /**
     * Whether a flush is scheduled.
     * @type {boolean}
     * @private
     */
    static _scheduled = false;

    /**
     * Schedules a read operation (e.g., getBoundingClientRect, offsetWidth).
     * These tasks run FIRST in the frame.
     *
     * @param {Function} task - The function to execute.
     * @returns {void}
     */
    static measure(task) {
        this._reads.push(task);
        this._scheduleFlush();
    }

    /**
     * Schedules a write operation (e.g., style assignment, classList manipulation).
     * These tasks run LAST in the frame.
     *
     * @param {Function} task - The function to execute.
     * @returns {void}
     */
    static mutate(task) {
        this._writes.push(task);
        this._scheduleFlush();
    }

    /**
     * Clears all pending tasks.
     *
     * @returns {void}
     */
    static clear() {
        this._reads = [];
        this._writes = [];
        this._scheduled = false;
    }

    /**
     * Schedules the flush for the next animation frame.
     *
     * @private
     * @returns {void}
     */
    static _scheduleFlush() {
        if (!this._scheduled) {
            this._scheduled = true;
            requestAnimationFrame(this._flush.bind(this));
        }
    }

    /**
     * Executes all queued tasks: reads first, then writes.
     *
     * @private
     * @returns {void}
     */
    static _flush() {
        const reads = this._reads;
        const writes = this._writes;

        this._reads = [];
        this._writes = [];
        this._scheduled = false;

        try {
            for (const task of reads) task();
        } catch (e) {
            console.error('[FastDOM] Error in measure task:', e);
        }

        try {
            for (const task of writes) task();
        } catch (e) {
            console.error('[FastDOM] Error in mutate task:', e);
        }
    }
}
