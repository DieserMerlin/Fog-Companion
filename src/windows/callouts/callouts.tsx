import {
  OWHotkeys
} from "@overwolf/overwolf-api-ts";

import { AppWindow } from "../../AppWindow";
import { kHotkeys, kWindowNames } from "../../consts";

import ReactDOM from "react-dom/client";
import { GameState, GameStateMap, GameStateType, MapResolver } from "../../game_state/GameState";
import { CalloutApp, useCalloutOrientation } from "./callout-app";

import { useMapBrowserNavigation } from "./browser/use-map-browser-navigation";
import { CALLOUT_SETTINGS } from "./callout-settings";

export class Callouts extends AppWindow {
  private static _instance: Callouts;

  private currentMap: GameStateMap | null = null;

  private constructor() {
    super(kWindowNames.callouts);

    overwolf.windows.getMainWindow().bus.on('game-state', gs => this.detectChangeMap(gs));
    overwolf.windows.getMainWindow().bus.on('select-map', async map => {
      this.currentMap = await MapResolver.makeMap({ mapFile: map.fileName, realm: map.realm });
      this.renderMap();
    });

    this.setToggleHotkeyBehavior();
    this.renderMap();

    overwolf.windows.getMainWindow().bus.on('game-info', state => {
      if (!state) return;

      overwolf.windows.getCurrentWindow(w => {
        const { top, width, height, left } = w.window;
        const { width: gameWidth, height: gameHeight } = state;
        const windowCenterX = left + width / 2;
        const side = windowCenterX < gameWidth / 2 ? 'left' : 'right';
        useCalloutOrientation.setState(side);
      });
    });
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new Callouts();
    }

    return this._instance;
  }

  detectChangeMap(gameState: GameState) {
    const newMap = gameState?.type === GameStateType.MATCH ? gameState.map || null : null;

    // Don't switch on variant change
    if (newMap && this.currentMap && [newMap.fullPath, ...newMap.variants?.map(map => map.fullPath)].includes(this.currentMap.fullPath))
      return;

    this.currentMap = newMap;
    this.renderMap();
  }

  switchVariant() {
    if (!!this.currentMap?.variants?.length) {
      const maps = [this.currentMap, ...this.currentMap.variants];
      this.currentMap.variants = undefined;
      maps.push(maps.shift());
      const [newMap, ...newVariants] = maps;
      newMap.variants = newVariants;
      this.currentMap = newMap;
    }
    this.renderMap();
  }

  async renderMap() {
    CALLOUT_SETTINGS.update({ map: this.currentMap || null });
  }

  private async setToggleHotkeyBehavior() {
    OWHotkeys.onHotkeyDown(kHotkeys.mapSwitchVar, () => this.switchVariant());
    OWHotkeys.onHotkeyDown(kHotkeys.mapToggleBrowser, () => {
      const current = CALLOUT_SETTINGS.getValue().browser;
      CALLOUT_SETTINGS.update({ browser: !current });
    });
    overwolf.games.inputTracking.onKeyDown.addListener(e => this.navigateMapBrowser(e.key))
  }

  private async navigateMapBrowser(key: string) {
    if (!CALLOUT_SETTINGS.getValue().browser) return;
    const api = useMapBrowserNavigation.getState();

    console.log('key', key);

    if (["87", "38"].includes(key)) // Up, W
      api.previous();
    if (["83", "40"].includes(key)) // Down, S
      api.next();
    if (["65", "37"].includes(key)) // Left, A
      api.close();
    if (["68", "39", "13", "32"].includes(key)) // Right, D, Space, Enter
      api.open();
  }
}

Callouts.instance();

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<CalloutApp />);
