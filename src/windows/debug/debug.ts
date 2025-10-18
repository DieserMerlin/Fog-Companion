
import { PSM } from "tesseract.js";
import { AppWindow } from "../../AppWindow";
import { kWindowNames } from "../../consts";
import { OcrAreasResult, performOcrAreas } from "../../utils/ocr/area-ocr";
import { GameStateGuesser as GameStateGuesser } from "../../game_state/GameState";

class Callouts extends AppWindow {
  private static _instance: Callouts;
  private currentMapImg: string | null = null;

  private constructor() {
    super(kWindowNames.callouts);

    const container = document.getElementById('canvas');
    const canvas = document.createElement('canvas');

    container.append(canvas);

    setInterval(async () =>
      performOcrAreas([
        { id: 'map', type: 'ocr', canvas, rect: { x: 0, y: .7, w: .5, h: .3 }, psm: PSM.SPARSE_TEXT },
        /*{ id: 'main-menu', type: 'ocr', rect: { x: .05, y: .05, w: .3, h: .4 }, psm: PSM.SPARSE_TEXT_OSD },
        { id: 'menu-btn', type: 'ocr', rect: { x: .8, y: .85, w: .2, h: .15 }, psm: PSM.SPARSE_TEXT },
        { id: 'bloodpoints', type: 'ocr', rect: { x: .7, y: 0, w: .3, h: .15 }, psm: PSM.SPARSE_TEXT_OSD },
        { id: 'loading-screen', type: 'pure-black', rects: [{ x: 0, y: 0, w: 1, h: .02 }, { x: 0, y: .98, w: 1, h: .02 }, { x: 0, y: .02, w: .02, h: .96 }, { x: .98, y: .02, w: .02, h: .96 }], blackMax: 10, colorDeltaMax: 3, minMatchRatio: .97 },
        { id: 'loading-text', type: 'ocr', rect: { x: .25, y: .3, w: .5, h: .4 }, psm: PSM.SPARSE_TEXT },
        { id: 'settings', type: 'ocr', rect: { x: 0, y: 0, w: 1, h: .2 }, psm: PSM.SPARSE_TEXT },*/
      ])
        .then(res => document.getElementById('output').innerText = JSON.stringify({ res})), 800);
  }

  private guesser = new GameStateGuesser();

  evaluateRes(res: OcrAreasResult) {
    const makeReturn = (key: string) => ({ type: key, res: res[key] });

    res['settings-back-btn'] = res['map'];

    if (res['map'] && res['map'].type === 'ocr') {
      if (res['map'].text.some(guess => this.guesser.guessMap(guess)))
        return makeReturn('map');
    }
    if (res['settings'] && res['settings'].type === 'ocr')
      if (this.guesser.guessSettings('right', res['settings']))
        return makeReturn('settings');
    if (res['loading-screen'] && res['loading-screen'].type === 'pure-black') {
      if (this.guesser.guessLoadingScreen(res['loading-screen']))
        return makeReturn('loading-screen');
    }
    if (res['loading-text'] && res['loading-text'].type === 'ocr') {
      if (this.guesser.guessLoadingScreen(undefined, res['loading-text']))
        return makeReturn('loading-text');
    }
    if (res['main-menu'] && res['main-menu'].type === 'ocr') {
      if (this.guesser.guessMenu('main-menu', res['main-menu']))
        return makeReturn('main-menu');
    }
    if (res['menu-btn'] && res['menu-btn'].type === 'ocr') {
      if (this.guesser.guessMenu('menu-btn', res['menu-btn']))
        return makeReturn('menu-btn');
    }
    if (res['bloodpoints'] && res['bloodpoints'].type === 'ocr') {
      if (this.guesser.guessMenu('bloodpoints', res['bloodpoints']))
        return makeReturn('bloodpoints');
    }
    if (res['settings-back-btn'] && res['settings-back-btn'].type === 'ocr')
      if (this.guesser.guessSettings('left', res['settings-back-btn']))
        return makeReturn('settings-back-btn');

    return null;
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new Callouts();
    }

    return this._instance;
  }
}

Callouts.instance();
