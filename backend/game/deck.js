class Deck {
  constructor() {
    this.suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    this.ranks = [
      { name: '2', value: 2 },
      { name: '3', value: 3 },
      { name: '4', value: 4 },
      { name: '5', value: 5 },
      { name: '6', value: 6 },
      { name: '7', value: 7 },
      { name: '8', value: 8 },
      { name: '9', value: 9 },
      { name: '10', value: 10 },
      { name: 'J', value: 11 },
      { name: 'Q', value: 12 },
      { name: 'K', value: 13 },
      { name: 'A', value: 14 },
    ];

    this.cards = [];
    this.createDeck();
    this.shuffle();
  }

  createDeck() {
    this.cards = [];
    for (const suit of this.suits) {
      for (const rank of this.ranks) {
        this.cards.push({
          suit,
          rank: rank.name,
          value: rank.value,
        });
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal() {
    return this.cards.pop();
  }
}

module.exports = Deck;
