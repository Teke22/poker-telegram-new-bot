const Player = require('./player');
const GameState = require('./gameState');

const p1 = new Player(1, 'Alice');
const p2 = new Player(2, 'Bot');

const game = new GameState([p1, p2]);

game.startHand(); // ✅ ВАЖНО

game.playerAction('fold');

setTimeout(() => {
  console.log('Фишки Alice:', p1.chips);
  console.log('Фишки Bot:', p2.chips);
}, 3500);
