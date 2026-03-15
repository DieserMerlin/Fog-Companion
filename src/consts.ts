export enum kWindowNames {
  mainInGame = 'main_in_game',
  mainDesktop = 'main_desktop',
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
  mode1v1SaveChallenge: 'mode_1v1_save_challenge',
  mode1v1NextGame: 'mode_1v1_next_game',

  mapSwitchVar: 'map_switch_variant',
  mapToggleBrowser: 'map_browser',
  mapUp: 'map_browser_up',
  mapDown: 'map_browser_down',
  mapLeft: 'map_browser_left',
  mapRight: 'map_browser_right',
} as const;

export const kDbdGameId = 10868;

export const kHotkeyLabels: Record<typeof kHotkeys[keyof typeof kHotkeys], string> = {
  app_showhide:              'Show/Hide App',
  map_showhide:              'Show/Hide Map',
  mode_1v1:                  '1v1 Mode',
  mode_scrim:                'Scrim Mode',
  mode_1v1_switch_surv:      'Switch to Survivor',
  mode_1v1_switch_kllr:      'Switch to Killer',
  mode_1v1_start_stop_timer: 'Start/Stop Timer',
  mode_1v1_reset_timer:      'Reset Timer',
  mode_1v1_reset_timers:     'Reset Both Timers',
  mode_1v1_save_challenge:   'Save Challenge',
  mode_1v1_next_game:        'Next Game',
  map_switch_variant:        'Switch Map Variant',
  map_browser:               'Map Browser',
  map_browser_up:            'Navigate Up',
  map_browser_down:          'Navigate Down',
  map_browser_left:          'Navigate Back',
  map_browser_right:         'Navigate Forward',
};