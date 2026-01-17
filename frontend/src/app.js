import { initSocket } from './socket/initSocket.js';
import { showLobby } from './ui/lobby.js';

const statusEl = document.getElementById('status');

statusEl.innerText = '🎮 Подключение к игре...';

const socket = io();

export const state = {
  socket,
  roomId: null,
  playerId: null,
};

// инициализация сокета
initSocket(socket, state, () => {
  statusEl.innerText = '🎮 Подключено';
  showLobby(state);
});
