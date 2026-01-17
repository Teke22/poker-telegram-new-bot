class PlayerState {
  constructor(user) {
    this.id = user.id;
    this.name = user.name;
    this.chips = user.chips;
    this.cards = [];
    this.bet = 0;
    this.folded = false;
    this.allIn = false;
  }

  deal(cards) {
    this.cards = cards;
  }

  public() {
    return {
      id: this.id,
      name: this.name,
      chips: this.chips,
      bet: this.bet,
      folded: this.folded,
      allIn: this.allIn
    };
  }
}

module.exports = PlayerState;
