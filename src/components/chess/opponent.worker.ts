import { chooseMove } from "./model";
self.onmessage = (event: MessageEvent<{ fen: string; level: number }>) => {
  self.postMessage(chooseMove(event.data.fen, event.data.level));
};
