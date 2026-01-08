const Player = require('./player');
const GameState = require('./gameState');

const p1 = new Player(1, 'Alice');
const p2 = new Player(2, 'Bob');

const game = new GameState([p1, p2]);

// Фейковая раздача
p1.hand = [
  { suit: 'hearts', value: 14 },
  { suit: 'hearts', value: 13 },
];

p2.hand = [
  { suit: 'clubs', value: 9 },
  { suit: 'spades', value: 9 },
];

game.board = [
  { suit: 'hearts', value: 12 },
  { suit: 'hearts', value: 11 },
  { suit: 'hearts', value: 10 },
  { suit: 'diamonds', value: 2 },
  { suit: 'clubs', value: 3 },
];

const winner = game.determineWinner();
console.log('Победитель:', winner.player.name);
console.log('Комбинация:', winner.hand);
