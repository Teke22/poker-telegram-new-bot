// game/Table.js
const { GameState } = require('./gameState');

class Table {
  constructor(code) {
    this.code = code;
    this.players = [];
    this.game = null;
  }

  addPlayer(player) {
    this.players.push(player);
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);

    if (this.game && !this.game.finished) {
      this.game.playerLeave(playerId);
    }
  }

  canStart() {
    return this.players.filter(p => p.chips > 0).length >= 2;
  }

  startHand() {
    if (!this.canStart()) {
      return false;
    }

    const playersForGame = this.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      isBot: p.isBot || false
    }));

    this.game = new GameState(playersForGame);
    return this.game.startGame();
  }

  handleAction(playerId, action) {
    if (!this.game) {
      throw new Error('Game not started');
    }

    this.game.playerAction(playerId, action);
    return this.game;
  }

  getPublicState() {
    return this.game ? this.game.getPublicState() : null;
  }

  getPrivateState(playerId) {
    return this.game ? this.game.getPlayerPrivateState(playerId) : null;
  }

  isFinished() {
    return this.game && this.game.finished;
  }
}

module.exports = Table;
