import { createContext } from 'react';

export const ScoreContext = createContext(0);
export const GameStateContext = createContext({
  isPlaying: false,
  togglePlay: () => {},
}); 