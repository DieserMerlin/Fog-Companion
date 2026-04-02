import OBSWebSocket from 'obs-websocket-js';
import { GameState, GameStateType } from '../../../game_state/GameState';
import { AppDB } from '../../../utils/indexeddb/AppDB';
import { ObsAction, ObsActionType, ObsTrigger } from './obs-types';
import { BACKGROUND_SETTINGS } from '../background-settings';
import { OBS_SETTINGS } from './obs-settings';
import { OBS_STATUS } from './obs-status';

const RECONNECT_DELAY_MS = 5000;

export class OBSManager {
  private obs = new OBSWebSocket();
  private _prevStateType: GameStateType | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _intentionalDisconnect = false;
  /** Incremented on every connect/disconnect so stale async events are ignored. */
  private _gen = 0;

  private constructor() {
    this.obs.on('ConnectionClosed', () => {
      const gen = this._gen;
      // Use setTimeout so this fires as a macrotask — by then any in-progress
      // connect() call will have incremented _gen, making this stale.
      setTimeout(() => {
        if (gen !== this._gen) return;
        if (this._intentionalDisconnect) return;
        OBS_STATUS.update({ status: 'disconnected', error: null });
        this.scheduleReconnect();
      }, 0);
    });

    this.obs.on('ConnectionError', (e: any) => {
      const gen = this._gen;
      setTimeout(() => {
        if (gen !== this._gen) return;
        if (this._intentionalDisconnect) return;
        OBS_STATUS.update({ status: 'error', error: e?.message ?? 'Connection error' });
        this.scheduleReconnect();
      }, 0);
    });
  }

  public static Instance(): OBSManager {
    const win = overwolf.windows.getMainWindow() as any;
    if (!win._obsManager) win._obsManager = new OBSManager();
    return win._obsManager;
  }

  public init() {
    // Reset status on startup
    if (!OBS_SETTINGS.getValue().enabled || !BACKGROUND_SETTINGS.getValue().enableSmartFeatures) {
      OBS_STATUS.update({ status: 'disconnected', error: null });
    }

    // React to OBS settings changes (host/port/password/enabled)
    OBS_SETTINGS.hook.subscribe((settings) => {
      if (settings.enabled && BACKGROUND_SETTINGS.getValue().enableSmartFeatures) {
        this.connect();
      } else {
        this.disconnect();
      }
    });

    // React to Smart Features toggle
    BACKGROUND_SETTINGS.hook.subscribe((settings) => {
      if (!settings.enableSmartFeatures) {
        this.disconnect();
      } else if (OBS_SETTINGS.getValue().enabled) {
        this.connect();
      }
    });

    // React to game-state transitions
    overwolf.windows.getMainWindow().bus.on('game-state', (gs) => {
      this.onGameState(gs);
    });

    // Connect immediately if enabled
    if (OBS_SETTINGS.getValue().enabled) {
      this.connect();
    }
  }

  // ── Connection ────────────────────────────────────────────────────────────

  public async connect() {
    this._gen++;
    const gen = this._gen;
    this.clearReconnectTimer();
    this._intentionalDisconnect = false;

    const { host, port, password } = OBS_SETTINGS.getValue();
    const url = `ws://${host}:${port}`;

    OBS_STATUS.update({ status: 'connecting', error: null });

    try {
      await this.obs.connect(url, password || undefined);
      if (gen !== this._gen) return; // superseded by a newer connect/disconnect
      OBS_STATUS.update({ status: 'connected', error: null });
    } catch (e: any) {
      if (gen !== this._gen) return;
      if (this._intentionalDisconnect) return;
      const msg = e?.message ?? String(e);
      OBS_STATUS.update({ status: 'error', error: msg });
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this._gen++;
    this._intentionalDisconnect = true;
    this.clearReconnectTimer();
    this.obs.disconnect();
    OBS_STATUS.update({ status: 'disconnected', error: null });
  }

  private scheduleReconnect() {
    if (this._intentionalDisconnect) return;
    if (!OBS_SETTINGS.getValue().enabled) return;
    this.clearReconnectTimer();
    this._reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
  }

  private clearReconnectTimer() {
    if (this._reconnectTimer != null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  // ── Transition detection ─────────────────────────────────────────────────

  private onGameState(gs: GameState) {
    if (!BACKGROUND_SETTINGS.getValue().enableSmartFeatures) return;

    const prev = this._prevStateType;
    const next = gs.type;

    if (prev !== next) {
      const triggers = this.resolveTriggers(prev, next);
      for (const trigger of triggers) {
        this.fireTrigger(trigger, gs);
      }
    }

    this._prevStateType = next;
  }

  private resolveTriggers(prev: GameStateType | null, next: GameStateType): ObsTrigger[] {
    const triggers: ObsTrigger[] = [];
    if (next === GameStateType.MATCH) triggers.push(ObsTrigger.TO_MATCH);
    if (next === GameStateType.MENU)  triggers.push(ObsTrigger.TO_MENU);
    if (next === GameStateType.LOADING) triggers.push(ObsTrigger.TO_LOADING);
    if (prev === GameStateType.MATCH)   triggers.push(ObsTrigger.FROM_MATCH);
    if (prev === GameStateType.MENU)    triggers.push(ObsTrigger.FROM_MENU);
    if (prev === GameStateType.LOADING) triggers.push(ObsTrigger.FROM_LOADING);
    return triggers;
  }

  private async fireTrigger(trigger: ObsTrigger, gs: GameState) {
    if (OBS_STATUS.getValue().status !== 'connected') return;

    const automations = await AppDB.obsAutomations
      .where('trigger').equals(trigger)
      .toArray();

    for (const automation of automations) {
      const matchTrigger = trigger === ObsTrigger.TO_MATCH || trigger === ObsTrigger.FROM_MATCH;
      if (matchTrigger && automation.verifiedOnly && !gs.map) {
        continue; // skip unverified match (fallback/loading transition, no map detected)
      }
      await this.executeActions(automation.actions);
    }
  }

  // ── Action execution ──────────────────────────────────────────────────────

  private async executeActions(actions: ObsAction[]) {
    for (const action of actions) {
      try {
        await this.executeAction(action);
      } catch (e) {
        // Silently swallow per-action errors (e.g. already recording)
        console.warn('[OBSManager] action failed:', action.type, e);
      }
    }
  }

  private async executeAction(action: ObsAction) {
    switch (action.type) {
      case ObsActionType.START_RECORDING:    return this.obs.call('StartRecord');
      case ObsActionType.STOP_RECORDING:     return this.obs.call('StopRecord');
      case ObsActionType.START_STREAMING:    return this.obs.call('StartStream');
      case ObsActionType.STOP_STREAMING:     return this.obs.call('StopStream');
      case ObsActionType.START_VIRTUAL_CAM:  return this.obs.call('StartVirtualCam');
      case ObsActionType.STOP_VIRTUAL_CAM:   return this.obs.call('StopVirtualCam');
      case ObsActionType.SWITCH_SCENE:
        return this.obs.call('SetCurrentProgramScene', { sceneName: action.scene });
      case ObsActionType.SET_PROFILE:
        return this.obs.call('SetCurrentProfile', { profileName: action.profile });
      case ObsActionType.DELAY:
        return new Promise<void>(r => setTimeout(r, action.seconds * 1000));
    }
  }

  // ── Public helpers for UI ─────────────────────────────────────────────────

  /** Fetch scene list from OBS (only works when connected). */
  public async getScenes(): Promise<string[]> {
    try {
      const res = await this.obs.call('GetSceneList');
      return (res.scenes as any[]).map(s => s.sceneName as string).reverse();
    } catch {
      return [];
    }
  }

  /** Fetch profile list from OBS (only works when connected). */
  public async getProfiles(): Promise<string[]> {
    try {
      const res = await this.obs.call('GetProfileList');
      return res.profiles as string[];
    } catch {
      return [];
    }
  }
}
