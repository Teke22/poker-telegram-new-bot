const Player = require('./player');
const GameState = require('./gameState');

const player1 = new Player(1, 'Alice');
const player2 = new Player(2, 'Bot');

const game = new GameState([player1, player2]);

game.startGame();

console.log('Карты игрока 1:', player1.hand);
console.log('Карты игрока 2:', player2.hand);

game.nextStage();
console.log('Флоп:', game.board);

game.nextStage();
console.log('Тёрн:', game.board);

game.nextStage();
console.log('Ривер:', game.board);

game.nextStage();
console.log('Стадия:', game.stage);
