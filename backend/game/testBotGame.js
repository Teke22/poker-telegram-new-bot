const Player = require('./player');
const GameState = require('./gameState');
const BotController = require('./botController');

const human = new Player(1, 'Alice');
const bot = new Player(2, 'Bot');

const game = new GameState([human, bot]);
new BotController(game, bot);

// 🤖 примитивный автоплеер для Alice
game.onTurn(() => {
  const player =
    game.players[game.currentPlayerIndex];

  if (player !== human) return;

  setTimeout(() => {
    try {
      if (game.currentBet > player.currentBet) {
        console.log('👤 Alice → call');
        game.playerAction('call');
      } else {
        console.log('👤 Alice → check');
        game.playerAction('check');
      }
    } catch (e) {
      console.error('Alice error:', e.message);
    }
  }, 500);
});

game.startHand();
