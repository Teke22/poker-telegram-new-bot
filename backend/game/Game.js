const GameState = require('./gameState');

class Game {
  constructor(players) {
    this.gameState = new GameState(players);
  }

  start() {
    this.gameState.startGame();
  }

  applyAction(playerId, action) {
    this.gameState.handleAction(playerId, action);
  }

  getPublicState() {
    return this.gameState.getPublicState();
  }

  get players() {
    return this.gameState.players;
  }
}

module.exports = Game;
