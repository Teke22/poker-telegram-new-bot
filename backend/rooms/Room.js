const Game = require('../game/Game');
const { nanoid } = require('nanoid');

class Room {
  constructor(io) {
    this.io = io;
    this.code = nanoid(5).toUpperCase();
    this.players = [];
    this.game = null;
  }

  addPlayer(user, socket) {
    socket.join(this.code);
    this.players.push({ ...user, socketId: socket.id });
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  startGame() {
    this.game = new Game(this.players);
    this.game.start();
    this.io.to(this.code).emit('game_started', {
      publicState: this.game.getPublicState()
    });
  }

  handleAction({ playerId, action }) {
    this.game.applyAction(playerId, action);
    this.io.to(this.code).emit('game_update', this.game.getPublicState());
  }

  sendPrivateCards(socket, playerId) {
    const player = this.game.players.find(p => p.id === playerId);
    if (player) socket.emit('my_cards', player.cards);
  }

  publicState() {
    return {
      code: this.code,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips
      }))
    };
  }
}

module.exports = Room;
