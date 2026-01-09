class Deck {
  constructor() {
    this.suits = ['♠', '♥', '♦', '♣'];
    this.ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.cards = [];
    this.createDeck();
    this.shuffle();
  }

  createDeck() {
    this.cards = [];
    for (const suit of this.suits) {
      for (const rank of this.ranks) {
        this.cards.push({ rank, suit });
      }
    }
  }

  // Алгоритм тасования Фишера-Йетса (используется в Python-боте)
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal() {
    if (this.cards.length === 0) {
      throw new Error('Deck is empty');
    }
    return this.cards.pop();
  }

  dealMultiple(count) {
    const dealtCards = [];
    for (let i = 0; i < count; i++) {
      if (this.cards.length === 0) break;
      dealtCards.push(this.deal());
    }
    return dealtCards;
  }

  // Оставшиеся карты в колоде
  remaining() {
    return this.cards.length;
  }

  // Перетасовать заново
  reshuffle() {
    this.createDeck();
    this.shuffle();
  }
}

module.exports = Deck;