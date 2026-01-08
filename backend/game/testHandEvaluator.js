const HandEvaluator = require('./handEvaluator');

const cards = [
  { suit: 'hearts', value: 14 },
  { suit: 'hearts', value: 13 },
  { suit: 'hearts', value: 12 },
  { suit: 'hearts', value: 11 },
  { suit: 'hearts', value: 10 },
  { suit: 'clubs', value: 2 },
  { suit: 'spades', value: 3 },
];

const result = HandEvaluator.evaluate(cards);
console.log(result);
