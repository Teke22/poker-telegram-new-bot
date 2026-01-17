import { showLobby } from '../ui/lobby.js';
import { showRoom } from '../ui/room.js';
import { showGame } from '../ui/table.js';

export function initSocket(state) {
  const socket = io({ transports: ['websocket'] });
  state.socket = socket;

  socket.on('connect', () => {
    console.log('✅ connected');
  });

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

    socket.emit('get_my_cards', {
      code: state.room.code,
      playerId: state.me.id
    });
  });

  socket.on('game_update', game => {
    state.game = game;
    showGame(state);
  });

  socket.on('my_cards', cards => {
    state.myCards = cards;
    showGame(state);
  });

  socket.on('error_msg', msg => {
    alert(msg);
    showLobby(state);
  });
}
