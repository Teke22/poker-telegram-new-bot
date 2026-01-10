// game/RoomManager.js
const Table = require('./Table');

class RoomManager {
  constructor() {
    this.rooms = {};
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return this.rooms[code] ? this.generateCode() : code;
  }

  createRoom(owner) {
    const code = this.generateCode();

    const table = new Table(code);
    table.addPlayer(owner);

    this.rooms[code] = {
      code,
      table,
      createdAt: new Date()
    };

    return this.rooms[code];
  }

  getRoom(code) {
    return this.rooms[code];
  }

  joinRoom(code, player) {
    const room = this.rooms[code];
    if (!room) return null;

    if (room.table.players.find(p => p.id === player.id)) {
      return room;
    }

    if (room.table.players.length >= 8) {
      throw new Error('Комната заполнена (максимум 8 игроков)');
    }

    room.table.addPlayer(player);
    return room;
  }

  leaveRoom(code, playerId) {
    const room = this.rooms[code];
    if (!room) return;

    room.table.removePlayer(playerId);

    if (room.table.players.length === 0) {
      delete this.rooms[code];
    }
  }

  listRooms() {
    return Object.values(this.rooms);
  }
}

module.exports = RoomManager;
