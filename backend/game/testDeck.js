const Deck = require('./deck');

const deck = new Deck();

console.log('Карта 1:', deck.deal());
console.log('Карта 2:', deck.deal());
console.log('Осталось карт:', deck.cards.length);
