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

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips ?? 1000,
      hand: [],
      folded: false
    }));

    this.deck = [];
    this.communityCards = [];
    this.stage = 'preflop';
    this.currentPlayerIndex = 0;
    this.finished = false;

    // 🔹 3.7.0 — ставки
    this.pot = 0;
    this.currentBet = 0;
    this.bets = {};
    this.lastAggressorIndex = null;
  }

  startGame() {
    this.deck = shuffle(createDeck());
    this.communityCards = [];
    this.stage = 'preflop';
    this.currentPlayerIndex = 0;
    this.finished = false;

    this.pot = 0;
    this.currentBet = 0;
    this.bets = {};
    this.lastAggressorIndex = null;

    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.folded = false;
      this.bets[p.id] = 0;
    });
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    let safety = 0;
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
      safety++;
    } while (this.currentPlayer.folded && safety < this.players.length);
  }

  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.currentPlayer;

    if (player.id !== playerId) {
      console.log('⛔ Not your turn');
      return;
    }

    console.log(`👤 ${player.name} →`, action);

    if (action === 'fold') {
      player.folded = true;
      this.finishHand();
      return;
    }

    if (action === 'check') {
      if (this.currentBet !== 0) {
        console.log('⛔ Cannot check, bet exists');
        return;
      }
      this.nextPlayer();
    }

    if (action?.type === 'bet') {
      if (this.currentBet !== 0) return;

      const amount = action.amount;
      if (amount <= 0 || amount > player.chips) return;

      player.chips -= amount;
      this.bets[player.id] += amount;
      this.currentBet = amount;
      this.pot += amount;
      this.lastAggressorIndex = this.currentPlayerIndex;

      this.nextPlayer();
    }

    if (action?.type === 'call') {
      const toCall = this.currentBet - this.bets[player.id];
      if (toCall <= 0 || toCall > player.chips) return;

      player.chips -= toCall;
      this.bets[player.id] += toCall;
      this.pot += toCall;

      this.nextPlayer();
    }

    if (action?.type === 'raise') {
      const raiseTo = action.amount;
      if (raiseTo <= this.currentBet) return;

      const diff = raiseTo - this.bets[player.id];
      if (diff > player.chips) return;

      player.chips -= diff;
      this.bets[player.id] += diff;
      this.pot += diff;
      this.currentBet = raiseTo;
      this.lastAggressorIndex = this.currentPlayerIndex;

      this.nextPlayer();
    }

    // 🔹 3.7.1 — проверка завершения круга ставок
    if (this.isBettingRoundComplete()) {
      console.log('🔁 Betting round finished');
      this.resetBetsForNextRound();
      // stage пока не меняем (flop/turn/river — следующий шаг)
    }
  }

  // 🔹 3.7.1 — ВСЕ УРАВНЯЛИ?
  isBettingRoundComplete() {
    const activePlayers = this.players.filter(p => !p.folded);

    const allMatched = activePlayers.every(
      p => this.bets[p.id] === this.currentBet
    );

    if (!allMatched) return false;

    if (this.currentBet === 0) {
      return true; // круг чеков
    }

    return this.currentPlayerIndex === this.lastAggressorIndex;
  }

  resetBetsForNextRound() {
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    this.players.forEach(p => {
      this.bets[p.id] = 0;
    });
  }

  finishHand() {
    this.finished = true;
    const winner = this.getWinner();
    console.log(`🏆 Winner: ${winner?.name}`);
  }

  getWinner() {
    return this.players.find(p => !p.folded) || null;
  }

  getPublicState() {
    return {
      stage: this.stage,
      finished: this.finished,
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerId: this.currentPlayer.id,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        folded: p.folded,
        chips: p.chips,
        bet: this.bets[p.id] || 0
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return player ? { hand: player.hand } : null;
  }
}

module.exports = { GameState };
