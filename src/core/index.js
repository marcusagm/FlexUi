/**
 * Description:
 * The core module barrel file.
 * It centralizes the exports of the core architecture components,
 * allowing for cleaner imports throughout the application.
 *
 * Exports:
 * - Disposable, CompositeDisposable, toDisposable
 * - Emitter, PauseableEmitter
 * - IRenderer
 * - LeakageMonitor
 * - UIElement
 */
export * from './Disposable.js';
export * from './Emitter.js';
export * from './IRenderer.js';
export * from './LeakageMonitor.js';
export * from './UIElement.js';
