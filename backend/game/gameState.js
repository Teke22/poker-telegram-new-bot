const HandEvaluator = require('./HandEvaluator');
const Deck = require('./deck');

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      hand: [],
      folded: false
    }));

    this.deck = new Deck();
    this.communityCards = [];
    this.currentPlayerIndex = 0;
    this.stage = 'waiting'; // waiting | preflop | finished
    this.finished = false;
    this.winners = [];
  }

  /* ================= GAME START ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this.deck.shuffle();
    this.communityCards = [];
    this.finished = false;
    this.winners = [];
    this.stage = 'preflop';

    // Раздаём по 2 карты
    this.players.forEach(p => {
      p.hand = [this.deck.draw(), this.deck.draw()];
      p.folded = false;
    });

    this.currentPlayerIndex = 0;
    return true;
  }

  /* ================= PLAYER ACTION ================= */

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
      // ничего не делаем, просто ход дальше
    }

    this.advanceTurn();
  }

  advanceTurn() {
    const activePlayers = this.players.filter(p => !p.folded);

    // Если остался один — он победил
    if (activePlayers.length === 1) {
      this.finished = true;
      this.winners = activePlayers;
      return;
    }

    let nextIndex = this.currentPlayerIndex;
    do {
      nextIndex = (nextIndex + 1) % this.players.length;
    } while (this.players[nextIndex].folded);

    this.currentPlayerIndex = nextIndex;
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      stage: this.stage,
      communityCards: this.communityCards,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        folded: p.folded
      })),
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      finished: this.finished,
      winners: this.winners.map(w => w.id)
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    return {
      hand: player.hand
    };
  }

  /* ================= LEAVE ================= */

  playerLeave(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (p) p.folded = true;

    const alive = this.players.filter(x => !x.folded);
    if (alive.length <= 1) {
      this.finished = true;
      this.winners = alive;
    }
  }
}

/* 🔴 КРИТИЧЕСКИ ВАЖНО */
module.exports = { GameState };
