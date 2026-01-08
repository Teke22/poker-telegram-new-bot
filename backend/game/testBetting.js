const Player = require('./player');
const GameState = require('./gameState');

const p1 = new Player(1, 'Alice');
const p2 = new Player(2, 'Bot');

const game = new GameState([p1, p2]);
game.startGame();

console.log('Банк:', game.pot);
console.log('Ставки:', p1.currentBet, p2.currentBet);

game.playerAction('call');
console.log('После call банк:', game.pot);
console.log('Раунд окончен:', game.isBettingRoundOver());
