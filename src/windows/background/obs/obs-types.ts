export enum ObsTrigger {
  TO_MATCH = 'TO_MATCH',
  FROM_MATCH = 'FROM_MATCH',
  TO_MENU = 'TO_MENU',
  FROM_MENU = 'FROM_MENU',
  TO_LOADING = 'TO_LOADING',
  FROM_LOADING = 'FROM_LOADING',
}

export const ObsTriggerLabel: Record<ObsTrigger, string> = {
  [ObsTrigger.TO_MATCH]: 'Entering Match',
  [ObsTrigger.FROM_MATCH]: 'Leaving Match',
  [ObsTrigger.TO_MENU]: 'Entering Menu',
  [ObsTrigger.FROM_MENU]: 'Leaving Menu',
  [ObsTrigger.TO_LOADING]: 'Entering Loading Screen',
  [ObsTrigger.FROM_LOADING]: 'Leaving Loading Screen',
};

export enum ObsActionType {
  START_RECORDING = 'START_RECORDING',
  STOP_RECORDING = 'STOP_RECORDING',
  START_STREAMING = 'START_STREAMING',
  STOP_STREAMING = 'STOP_STREAMING',
  START_VIRTUAL_CAM = 'START_VIRTUAL_CAM',
  STOP_VIRTUAL_CAM = 'STOP_VIRTUAL_CAM',
  SWITCH_SCENE = 'SWITCH_SCENE',
  SET_PROFILE = 'SET_PROFILE',
  DELAY = 'DELAY',
}

export const ObsActionLabel: Record<ObsActionType, string> = {
  [ObsActionType.START_RECORDING]: 'Start Recording',
  [ObsActionType.STOP_RECORDING]: 'Stop Recording',
  [ObsActionType.START_STREAMING]: 'Start Streaming',
  [ObsActionType.STOP_STREAMING]: 'Stop Streaming',
  [ObsActionType.START_VIRTUAL_CAM]: 'Start Virtual Camera',
  [ObsActionType.STOP_VIRTUAL_CAM]: 'Stop Virtual Camera',
  [ObsActionType.SWITCH_SCENE]: 'Switch Scene',
  [ObsActionType.SET_PROFILE]: 'Set Profile',
  [ObsActionType.DELAY]: 'Delay',
};

export type ObsAction =
  | { type: ObsActionType.START_RECORDING }
  | { type: ObsActionType.STOP_RECORDING }
  | { type: ObsActionType.START_STREAMING }
  | { type: ObsActionType.STOP_STREAMING }
  | { type: ObsActionType.START_VIRTUAL_CAM }
  | { type: ObsActionType.STOP_VIRTUAL_CAM }
  | { type: ObsActionType.SWITCH_SCENE; scene: string }
  | { type: ObsActionType.SET_PROFILE; profile: string }
  | { type: ObsActionType.DELAY; seconds: number };

export type ObsAutomation = {
  id: string;
  trigger: ObsTrigger;
  /** Only relevant for TO_MATCH / FROM_MATCH: require a map to have been detected (no fallback). */
  verifiedOnly: boolean;
  actions: ObsAction[];
};

/** Triggers shown in the UI. The full enum is kept for forward compatibility. */
export const ObsTriggerVisible = [
  ObsTrigger.TO_MATCH,
  ObsTrigger.FROM_MATCH,
  ObsTrigger.TO_LOADING,
  ObsTrigger.TO_MENU,
] as const;

/** Action types shown in the UI. The full enum is kept for forward compatibility. */
export const ObsActionTypeVisible = [
  ObsActionType.SWITCH_SCENE,
  ObsActionType.DELAY,
] as const;
