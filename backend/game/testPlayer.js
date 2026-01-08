const Player = require('./player');

const player = new Player(1, 'Alice');

console.log('Стартовые фишки:', player.chips);

player.bet(200);
console.log('После ставки 200:', player.chips, player.currentBet);

player.bet(1000);
console.log('После all-in:', player.chips, player.currentBet, player.status);

player.fold();
console.log('После fold:', player.status, player.hand);
