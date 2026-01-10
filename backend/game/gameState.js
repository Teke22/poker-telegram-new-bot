class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      bet: 0,
      folded: false,
      allIn: false
    }));

    this.deck = this.createDeck();
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayerIndex = 0;
    this.stage = 'preflop'; // preflop → flop → turn → river
    this.finished = false;
    this.winners = [];

    this.communityCards = [];
  }

  /* ================= DECK ================= */

  createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const deck = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit });
      }
    }

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }

  draw() {
    return this.deck.pop();
  }

  /* ================= START ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this.players.forEach(p => {
      p.hand = [this.draw(), this.draw()];
      p.bet = 0;
      p.folded = false;
      p.allIn = false;
    });

    this.currentPlayerIndex = 0;
    this.currentBet = 0;
    this.pot = 0;
    this.finished = false;
    this.stage = 'preflop';
    this.communityCards = [];

    return true;
  }

  /* ================= ACTIONS ================= */

  playerAction(playerId, action) {
    if (this.finished) throw new Error('Game finished');

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== playerId) {
      throw new Error('Not your turn');
    }

    // ✅ НОРМАЛИЗАЦИЯ ACTION
    if (typeof action === 'string') {
      action = { type: action };
    }

    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;

      case 'check':
        if (this.currentBet > player.bet) {
          throw new Error('Cannot check');
        }
        break;

      case 'call': {
        const toCall = this.currentBet - player.bet;
        if (toCall > player.chips) throw new Error('Not enough chips');
        player.chips -= toCall;
        player.bet += toCall;
        this.pot += toCall;
        break;
      }

      case 'bet': {
        if (this.currentBet !== 0) throw new Error('Bet not allowed');
        const amount = action.amount;
        if (amount > player.chips) throw new Error('Not enough chips');
        player.chips -= amount;
        player.bet += amount;
        this.currentBet = amount;
        this.pot += amount;
        break;
      }

      case 'raise': {
        const amount = action.amount;
        const toPut = amount - player.bet;
        if (toPut > player.chips) throw new Error('Not enough chips');
        player.chips -= toPut;
        this.pot += toPut;
        player.bet = amount;
        this.currentBet = amount;
        break;
      }

      default:
        throw new Error('UNKNOWN COMMAND');
    }

    this.nextPlayer();
    this.checkFinish();
  }

  /* ================= FLOW ================= */

  nextPlayer() {
    const alive = this.players.filter(p => !p.folded && p.chips >= 0);
    if (alive.length <= 1) {
      this.finishByFold();
      return;
    }

    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
    } while (
      this.players[this.currentPlayerIndex].folded ||
      this.players[this.currentPlayerIndex].allIn
    );
  }

  finishByFold() {
    const winner = this.players.find(p => !p.folded);
    if (winner) {
      winner.chips += this.pot;
      this.winners = [winner];
    }
    this.finished = true;
  }

  checkFinish() {
    const active = this.players.filter(p => !p.folded);
    if (active.length === 1) {
      this.finishByFold();
    }
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn
      })),
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      stage: this.stage,
      communityCards: this.communityCards,
      finished: this.finished
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
    this.checkFinish();
  }
}

module.exports = { GameState };
