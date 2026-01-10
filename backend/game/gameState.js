class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      hand: [],
      bet: 0,
      folded: false,
      allIn: false
    }));

    this.deck = this.createDeck();
    this.communityCards = [];
    this.pot = 0;

    this.stage = 'preflop'; // preflop | flop | turn | river | showdown
    this.currentPlayerIndex = 0;
    this.currentBet = 0;
    this.finished = false;
  }

  /* ================= SETUP ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this.shuffle(this.deck);

    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.bet = 0;
      p.folded = false;
      p.allIn = false;
    });

    this.currentPlayerIndex = 0;
    this.currentBet = 0;
    this.pot = 0;
    this.communityCards = [];
    this.stage = 'preflop';
    this.finished = false;

    return true;
  }

  createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const deck = [];
    for (const s of suits) {
      for (const r of ranks) {
        deck.push({ rank: r, suit: s });
      }
    }
    return deck;
  }

  shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  /* ================= ACTIONS ================= */

  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (player.folded || player.allIn) {
      this.nextPlayer();
      return;
    }

    // STRING ACTIONS
    if (action === 'fold') {
      player.folded = true;
    }

    if (action === 'check') {
      if (this.currentBet > player.bet) {
        throw new Error('Cannot check');
      }
    }

    // OBJECT ACTIONS
    if (typeof action === 'object') {
      const { type, amount } = action;

      if (type === 'bet') {
        if (this.currentBet !== 0) {
          throw new Error('Bet not allowed');
        }
        this.placeBet(player, amount);
      }

      if (type === 'call') {
        const toCall = this.currentBet - player.bet;
        this.placeBet(player, toCall);
      }

      if (type === 'raise') {
        if (amount <= this.currentBet) {
          throw new Error('Raise too small');
        }
        const diff = amount - player.bet;
        this.currentBet = amount;
        this.placeBet(player, diff);
      }
    }

    this.nextPlayer();
    this.checkRoundEnd();
  }

  placeBet(player, amount) {
    if (amount <= 0) return;

    if (amount >= player.chips) {
      amount = player.chips;
      player.allIn = true;
    }

    player.chips -= amount;
    player.bet += amount;
    this.pot += amount;

    if (player.bet > this.currentBet) {
      this.currentBet = player.bet;
    }
  }

  /* ================= FLOW ================= */

  nextPlayer() {
    let count = this.players.length;
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
      count--;
    } while (
      count > 0 &&
      (this.players[this.currentPlayerIndex].folded ||
       this.players[this.currentPlayerIndex].allIn)
    );
  }

  checkRoundEnd() {
    const active = this.players.filter(p => !p.folded);

    if (active.length === 1) {
      active[0].chips += this.pot;
      this.finished = true;
      return;
    }

    const allMatched = active.every(p => p.bet === this.currentBet || p.allIn);

    if (allMatched) {
      this.advanceStage();
    }
  }

  advanceStage() {
    this.players.forEach(p => (p.bet = 0));
    this.currentBet = 0;

    if (this.stage === 'preflop') {
      this.stage = 'flop';
      this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
    } else if (this.stage === 'flop') {
      this.stage = 'turn';
      this.communityCards.push(this.deck.pop());
    } else if (this.stage === 'turn') {
      this.stage = 'river';
      this.communityCards.push(this.deck.pop());
    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      this.finished = true;
      // временно: победитель — первый активный
      const winner = this.players.find(p => !p.folded);
      if (winner) winner.chips += this.pot;
    }
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      communityCards: this.communityCards,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      currentBet: this.currentBet,
      finished: this.finished,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (!p) return null;
    return { hand: p.hand };
  }

  playerLeave(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (p) p.folded = true;
  }
}

module.exports = { GameState };
