import { showRoom } from '../ui/room.js';
import { showGame } from '../ui/table.js';

export function initSocket(state) {
  const socket = io({ transports: ['websocket'] });
  state.socket = socket;

  socket.on('room_joined', room => {
    state.room = room;
    showRoom(state);
  });

  socket.on('room_update', room => {
    state.room = room;
    showRoom(state);
  });

  socket.on('game_started', ({ publicState }) => {
    state.game = publicState;
    showGame(state);
  });

  socket.on('game_update', game => {
    state.game = game;
    showGame(state);
  });

  socket.on('my_cards', cards => {
    state.myCards = cards;
    showGame(state);
  });
}
