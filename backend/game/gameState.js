// backend/game/gameState.js

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
    this.currentBet = 0;

    this.stage = 'preflop'; // preflop | flop | turn | river | showdown
    this.currentPlayerIndex = 0;
    this.finished = false;

    this.lastAggressorIndex = null;
  }

  /* ================== INIT ================== */

  startGame() {
    if (this.players.length < 2) return false;

    this.shuffle(this.deck);

    // раздача карт
    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
    });

    this.currentPlayerIndex = 0;
    this.stage = 'preflop';

    return true;
  }

  /* ================== ACTIONS ================== */

  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== playerId) {
      throw new Error('Not your turn');
    }

    // === STRING actions ===
    if (action === 'fold') {
      player.folded = true;
      this.advanceTurn();
      this.checkHandEnd();
      return;
    }

    if (action === 'check') {
      if (this.currentBet > player.bet) {
        throw new Error('Cannot check');
      }
      this.advanceTurn();
      this.checkRoundEnd();
      return;
    }

    // === OBJECT actions ===
    if (typeof action === 'object') {
      const { type, amount } = action;

      if (type === 'call') {
        const toCall = this.currentBet - player.bet;
        if (toCall > player.chips) throw new Error('Not enough chips');

        player.chips -= toCall;
        player.bet += toCall;
        this.pot += toCall;

        this.advanceTurn();
        this.checkRoundEnd();
        return;
      }

      if (type === 'bet' || type === 'raise') {
        if (amount <= this.currentBet) {
          throw new Error('Bet too small');
        }

        const diff = amount - player.bet;
        if (diff > player.chips) throw new Error('Not enough chips');

        player.chips -= diff;
        player.bet = amount;
        this.pot += diff;

        this.currentBet = amount;
        this.lastAggressorIndex = this.currentPlayerIndex;

        this.advanceTurn();
        return;
      }
    }

    throw new Error('Unknown command');
  }

  /* ================== FLOW ================== */

  advanceTurn() {
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
    } while (
      this.players[this.currentPlayerIndex].folded ||
      this.players[this.currentPlayerIndex].chips === 0
    );
  }

  checkRoundEnd() {
    const active = this.players.filter(p => !p.folded);
    const allMatched = active.every(p => p.bet === this.currentBet);

    if (allMatched) {
      this.nextStage();
    }
  }

  nextStage() {
    // сброс ставок
    this.players.forEach(p => (p.bet = 0));
    this.currentBet = 0;
    this.currentPlayerIndex = 0;

    if (this.stage === 'preflop') {
      this.stage = 'flop';
      this.communityCards.push(
        this.deck.pop(),
        this.deck.pop(),
        this.deck.pop()
      );
      return;
    }

    if (this.stage === 'flop') {
      this.stage = 'turn';
      this.communityCards.push(this.deck.pop());
      return;
    }

    if (this.stage === 'turn') {
      this.stage = 'river';
      this.communityCards.push(this.deck.pop());
      return;
    }

    if (this.stage === 'river') {
      this.finishHand();
    }
  }

  checkHandEnd() {
    const active = this.players.filter(p => !p.folded);
    if (active.length === 1) {
      active[0].chips += this.pot;
      this.finished = true;
    }
  }

  finishHand() {
    // временно: победитель — первый не сфолдивший
    const winner = this.players.find(p => !p.folded);
    if (winner) {
      winner.chips += this.pot;
    }
    this.finished = true;
    this.stage = 'showdown';
  }

  /* ================== STATE ================== */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      communityCards: this.communityCards,
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
    const p = this.players.find(p => p.id === playerId);
    if (!p) return null;
    return { hand: p.hand };
  }

  /* ================== DECK ================== */

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
}

module.exports = { GameState };
