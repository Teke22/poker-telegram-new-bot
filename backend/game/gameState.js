const Deck = require('./deck');
const HandEvaluator = require('./handEvaluator');

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

    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;

    this.stage = 'waiting'; // waiting | preflop | flop | turn | river | showdown
    this.currentPlayerIndex = 0;
    this.finished = false;
    this.winners = [];
  }

  /* ================= START GAME ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this.stage = 'preflop';
    this.finished = false;
    this.pot = 0;
    this.communityCards = [];

    this.deck.shuffle();

    // clear hands
    this.players.forEach(p => {
      p.hand = [];
      p.bet = 0;
      p.folded = false;
      p.allIn = false;
    });

    // deal 2 cards
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        player.hand.push(this.deck.draw());
      });
    }

    this.currentPlayerIndex = 0;
    return true;
  }

  /* ================= ACTIONS ================= */

  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (action.type === 'fold') {
      player.folded = true;
    }

    if (action.type === 'check') {
      // nothing for now
    }

    this.nextTurn();
  }

  nextTurn() {
    if (this.isOnlyOneLeft()) {
      this.finishByFold();
      return;
    }

    let next = this.currentPlayerIndex;
    do {
      next = (next + 1) % this.players.length;
    } while (this.players[next].folded);

    this.currentPlayerIndex = next;
  }

  /* ================= FINISH ================= */

  isOnlyOneLeft() {
    return this.players.filter(p => !p.folded).length === 1;
  }

  finishByFold() {
    this.finished = true;
    const winner = this.players.find(p => !p.folded);
    if (winner) {
      winner.chips += this.pot;
      this.winners = [winner.id];
    }
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      communityCards: this.communityCards,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;
    return { hand: player.hand };
  }

  playerLeave(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (p) p.folded = true;
  }
}

/* ❗❗❗ ВАЖНО ❗❗❗ */
module.exports = { GameState };
