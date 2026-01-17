import { initUser } from './state/user.js';
import { initSocket } from './socket/handlers.js';
import { showLobby } from './ui/lobby.js';

export const state = {
  me: initUser(),
  room: null,
  game: null,
  myCards: [],
  socket: null
};

initSocket(state);
showLobby(state);
