const Room = require('./Room');
const UserManager = require('../users/UserManager');

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.users = new UserManager();
  }

  bindSocket(socket) {
    socket.on('create_room', ({ user }) => {
      const room = new Room(this.io);
      room.addPlayer(user, socket);
      this.rooms.set(room.code, room);
      socket.emit('room_joined', room.publicState());
    });

    socket.on('join_room', ({ code, user }) => {
      const room = this.rooms.get(code);
      if (!room) return socket.emit('error_msg', 'Комната не найдена');
      room.addPlayer(user, socket);
      this.io.to(code).emit('room_update', room.publicState());
    });

    socket.on('leave_room', ({ code, playerId }) => {
      const room = this.rooms.get(code);
      if (!room) return;
      room.removePlayer(playerId);
      this.io.to(code).emit('room_update', room.publicState());
    });

    socket.on('start_game', ({ code }) => {
      const room = this.rooms.get(code);
      if (!room) return;
      room.startGame();
    });

    socket.on('player_action', data => {
      const room = this.rooms.get(data.code);
      if (!room) return;
      room.handleAction(data);
    });

    socket.on('get_my_cards', data => {
      const room = this.rooms.get(data.code);
      if (!room) return;
      room.sendPrivateCards(socket, data.playerId);
    });
  }
}

module.exports = RoomManager;
