function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }

  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 🔹 временно: сравнение по старшей карте
function getHandRank(hand, community) {
  const all = [...hand, ...community];
  const values = all.map(c => {
    if (c.rank === 'A') return 14;
    if (c.rank === 'K') return 13;
    if (c.rank === 'Q') return 12;
    if (c.rank === 'J') return 11;
    return parseInt(c.rank);
  });
  return Math.max(...values);
}

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips ?? 1000,
      hand: [],
      folded: false,
      allIn: false,
      bet: 0
    }));

    this.deck = [];
    this.communityCards = [];
    this.stage = 'waiting';
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;

    this.finished = false;
    this.roundFinished = false;

    this.pot = 0;
    this.currentBet = 0;
    this.lastAggressorIndex = null;

    this.smallBlind = 10;
    this.bigBlind = 20;

    // 🔹 НОВОЕ
    this.winner = null;
    this.handEndReason = null;
  }

  startGame() {
    this.deck = shuffle(createDeck());
    this.communityCards = [];
    this.stage = 'preflop';
    this.finished = false;
    this.roundFinished = false;

    this.pot = 0;
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    this.winner = null;
    this.handEndReason = null;

    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.folded = false;
      p.allIn = false;
      p.bet = 0;
    });

    const sb = (this.dealerIndex + 1) % this.players.length;
    const bb = (this.dealerIndex + 2) % this.players.length;

    this.postBlind(sb, this.smallBlind);
    this.postBlind(bb, this.bigBlind);

    this.currentPlayerIndex = (bb + 1) % this.players.length;
    this.currentBet = this.bigBlind;
  }

  postBlind(index, amount) {
    const p = this.players[index];
    const a = Math.min(amount, p.chips);
    p.chips -= a;
    p.bet = a;
    this.pot += a;
    if (p.chips === 0) p.allIn = true;
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    let i = 0;
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
      i++;
    } while (
      i < this.players.length &&
      (this.currentPlayer.folded || this.currentPlayer.allIn)
    );
  }

  playerAction(playerId, action) {
    if (this.finished || this.roundFinished) return;

    const p = this.currentPlayer;
    if (p.id !== playerId) return;

    if (action === 'fold') {
      p.folded = true;
      this.checkHandCompletion();
      return;
    }

    if (action === 'check') {
      if (this.currentBet > p.bet) return;
      this.nextPlayer();
      this.checkBettingRoundCompletion();
      return;
    }

    if (action?.type === 'bet') {
      this.makeBet(p, action.amount);
      this.lastAggressorIndex = this.currentPlayerIndex;
      this.nextPlayer();
      this.checkBettingRoundCompletion();
    }

    if (action?.type === 'call') {
      this.makeBet(p, this.currentBet - p.bet);
      this.nextPlayer();
      this.checkBettingRoundCompletion();
    }

    if (action?.type === 'raise') {
      this.makeBet(p, action.amount - p.bet);
      this.currentBet = action.amount;
      this.lastAggressorIndex = this.currentPlayerIndex;
      this.nextPlayer();
      this.checkBettingRoundCompletion();
    }
  }

  makeBet(p, amount) {
    const a = Math.min(amount, p.chips);
    p.chips -= a;
    p.bet += a;
    this.pot += a;
    if (p.chips === 0) p.allIn = true;
  }

  checkBettingRoundCompletion() {
    const active = this.players.filter(p => !p.folded);
    const matched = active.every(p => p.bet === this.currentBet || p.allIn);
    if (!matched) return;

    this.finishBettingRound();
  }

  finishBettingRound() {
    this.roundFinished = true;

    this.players.forEach(p => (p.bet = 0));
    this.currentBet = 0;
    this.lastAggressorIndex = null;

    setTimeout(() => this.advanceStage(), 800);
  }

  advanceStage() {
    this.roundFinished = false;

    if (this.stage === 'preflop') {
      this.stage = 'flop';
      this.dealCommunityCards(3);
    } else if (this.stage === 'flop') {
      this.stage = 'turn';
      this.dealCommunityCards(1);
    } else if (this.stage === 'turn') {
      this.stage = 'river';
      this.dealCommunityCards(1);
    } else {
      this.finishHand('showdown');
      return;
    }

    this.setFirstPlayerAfterDealer();
  }

  dealCommunityCards(n) {
    for (let i = 0; i < n; i++) {
      this.communityCards.push(this.deck.pop());
    }
  }

  setFirstPlayerAfterDealer() {
    for (let i = 1; i <= this.players.length; i++) {
      const idx = (this.dealerIndex + i) % this.players.length;
      const p = this.players[idx];
      if (!p.folded && !p.allIn) {
        this.currentPlayerIndex = idx;
        break;
      }
    }
  }

  checkHandCompletion() {
    const active = this.players.filter(p => !p.folded);
    if (active.length <= 1) {
      this.finishHand('fold');
    }
  }

  finishHand(reason) {
    if (this.finished) return;
    this.finished = true;
    this.handEndReason = reason;

    const active = this.players.filter(p => !p.folded);

    if (active.length === 1) {
      this.winner = active[0];
      this.winner.chips += this.pot;
    } else {
      let best = -1;
      let winners = [];

      for (const p of active) {
        const r = getHandRank(p.hand, this.communityCards);
        if (r > best) {
          best = r;
          winners = [p];
        } else if (r === best) {
          winners.push(p);
        }
      }

      const prize = Math.floor(this.pot / winners.length);
      winners.forEach(w => (w.chips += prize));
      this.winner = winners[0];
    }

    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    this.scheduleNextHand();
  }

  scheduleNextHand() {
    setTimeout(() => {
      this.startGame();
    }, 3000);
  }

  getPublicState() {
    return {
      stage: this.stage,
      finished: this.finished,
      pot: this.pot,
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      currentPlayerId: this.currentPlayer?.id || null,
      winner: this.winner
        ? { id: this.winner.id, name: this.winner.name }
        : null,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        folded: p.folded,
        chips: p.chips,
        bet: p.bet,
        allIn: p.allIn
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const p = this.players.find(p => p.id === playerId);
    return p ? { hand: p.hand } : null;
  }
}

module.exports = { GameState };
