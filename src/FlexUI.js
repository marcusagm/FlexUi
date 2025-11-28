/**
 * Description:
 * The main entry point for the FlexUI library.
 * It acts as a facade for the entire system, exporting only the safe,
 * public-facing classes and APIs intended for external consumption.
 *
 * Usage:
 * import { FlexUI, PanelApi } from './FlexUI.js';
 *
 * Exports:
 * - FlexUI (alias for the App singleton/class)
 * - PanelApi (Facade for Panel interaction)
 * - GroupApi (Facade for PanelGroup interaction)
 * - WindowApi (Facade for Window interaction)
 */

export { App as FlexUI } from './App.js';
export { PanelApi } from './api/PanelApi.js';
export { GroupApi } from './api/GroupApi.js';
export { WindowApi } from './api/WindowApi.js';
