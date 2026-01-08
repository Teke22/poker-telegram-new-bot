const BotAI = require('./botAI');

class BotController {
  constructor(game, bot) {
    this.game = game;
    this.bot = bot;
    this.ai = new BotAI();

    this.game.onTurn(() => this.tryMove());
  }

  tryMove() {
    if (this.game.gameStatus !== 'playing') return;

    const current =
      this.game.players[this.game.currentPlayerIndex];
    if (current !== this.bot) return;

    setTimeout(() => {
      const { action, amount } =
        this.ai.decideAction(this.game, this.bot);

      console.log(`🤖 Bot → ${action}`);
      this.game.playerAction(action, amount);
    }, 1000);
  }
}

module.exports = BotController;
