export enum kWindowNames {
  inGame = 'in_game',
  mode_1v1 = 'mode_1v1',
  callouts = 'callouts',
  debug = 'debug',
};

export const kHotkeys = {
  toggleMainWindow: 'app_showhide',
  toggleMapWindow: 'map_showhide',

  toggleMode1v1: 'mode_1v1',
  toggleModeScrim: 'mode_scrim',

  mode1v1switchToSurv: 'mode_1v1_switch_surv',
  mode1v1switchToKllr: 'mode_1v1_switch_kllr',
  mode1v1startStopTimer: 'mode_1v1_start_stop_timer',
  mode1v1resetTimer: 'mode_1v1_reset_timer',
  mode1v1resetTimers: 'mode_1v1_reset_timers',

  mapSwitchVar: 'map_switch_variant',
  mapToggleBrowser: 'map_browser',
  mapUp: 'map_browser_up',
  mapDown: 'map_browser_down',
  mapLeft: 'map_browser_left',
  mapRight: 'map_browser_right',
} as const;

export const kDbdGameId = 10868;