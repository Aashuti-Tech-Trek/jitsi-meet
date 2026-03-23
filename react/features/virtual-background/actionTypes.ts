/**
 * The type of redux action dispatched which represents that the background
 * effect is enabled or not.
 *
 * @returns {{
 *     type: BACKGROUND_ENABLED,
 *     backgroundEffectEnabled: boolean
 * }}
 */
export const BACKGROUND_ENABLED = 'BACKGROUND_ENABLED';

/**
 * The type of the action which sets the virtual background performance statistics.
 * This action is dispatched on every frame processed to provide live metrics.
 *
 * @returns {{
 *     type: SET_VIRTUAL_BACKGROUND_STATS,
 *     stats: Object
 * }}
 */
export const SET_VIRTUAL_BACKGROUND_STATS = 'SET_VIRTUAL_BACKGROUND_STATS';

/**
 * The type of the action which enables or disables the virtual background performance statistics overlay.
 * This determines whether the VirtualBackgroundStats component is rendered.
 *
 * @returns {{
 *     type: SET_VIRTUAL_BACKGROUND_STATS_ENABLED,
 *     statsEnabled: boolean
 * }}
 */
export const SET_VIRTUAL_BACKGROUND_STATS_ENABLED = 'SET_VIRTUAL_BACKGROUND_STATS_ENABLED';

/**
 * The type of the action which enables or disables virtual background
 *
 * @returns {{
 *     type: SET_VIRTUAL_BACKGROUND,
 *     virtualSource: string,
 *     blurValue: number,
 *     backgroundType: string,
 *     selectedThumbnail: string
 * }}
 */
export const SET_VIRTUAL_BACKGROUND = 'SET_VIRTUAL_BACKGROUND';
