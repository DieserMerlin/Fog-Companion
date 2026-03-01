import { create } from "zustand";
import { GameState, GameStateType } from "../../game_state/GameState";

const initialState =
  (overwolf.windows.getMainWindow().cache?.gameState as GameState | undefined)
  || { type: GameStateType.UNKNOWN };

export const useGameState = create<{ state: GameState }>(() => ({ state: initialState }));
overwolf.windows.getMainWindow().bus.on('game-state', state => useGameState.setState({ state }));
