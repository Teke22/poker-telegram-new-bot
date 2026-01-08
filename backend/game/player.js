class Player {
  constructor(telegramId, name) {
    this.id = telegramId;
    this.name = name;

    this.chips = 1000;
    this.hand = [];

    this.status = 'active';
    this.currentBet = 0;
  }

  resetForNewRound() {
    this.hand = [];
    this.currentBet = 0;
    this.status = 'active';
  }

  receiveCard(card) {
    this.hand.push(card);
  }

  bet(amount) {
    const bet = Math.min(this.chips, amount);
    this.chips -= bet;
    this.currentBet += bet;
    return bet;
  }

  fold() {
    this.status = 'folded';
  }
}

module.exports = Player;
