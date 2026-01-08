const GameState = require('../game/gameState');
const Player = require('../game/player');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  createRoom(ownerData) {
    const code = this.generateCode();

    const owner = new Player(
      ownerData.telegramId,
      ownerData.username
    );

    const game = new GameState([owner]);

    this.rooms.set(code, {
      code,
      players: [owner],
      game
    });

    return code;
  }

  joinRoom(code, userData) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Комната не найдена');

    if (room.players.length >= 6)
      throw new Error('Комната заполнена');

    const player = new Player(
      userData.telegramId,
      userData.username
    );

    room.players.push(player);
    room.game.players = room.players;

    return room;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }
}

module.exports = RoomManager;
