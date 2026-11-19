// Add a new game mode: create js/games/<id>/index.js (subclass of BaseGame) and list it here.
import FruitSlasher from './fruit-slasher/index.js';
import Basketball from './basketball/index.js';
import Penalty from './penalty/index.js';
import Tennis from './tennis/index.js';

export const GAMES = [FruitSlasher, Basketball, Penalty, Tennis];

export function getGame(id) {
  return GAMES.find((g) => g.meta.id === id);
}
