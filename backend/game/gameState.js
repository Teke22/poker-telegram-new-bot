const Deck = require('./deck');
const HandEvaluator = require('./handEvaluator');

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      hand: [],
      folded: false,
      bet: 0
    }));

    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;

    this.stage = 'waiting'; // waiting | preflop | flop | turn | river | showdown
    this.currentPlayerIndex = 0;
    this.finished = false;
  }

  /* ================== GAME START ================== */

  startGame() {
    if (this.players.length < 2) return false;

    this.deck.shuffle();
    this.stage = 'preflop';
    this.finished = false;

    // очистка
    this.communityCards = [];
    this.pot = 0;

    this.players.forEach(p => {
      p.hand = [];
      p.folded = false;
      p.bet = 0;
    });

    // раздача 2 карт
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        if (player.chips > 0) {
          player.hand.push(this.deck.draw());
        }
      });
    }

    this.currentPlayerIndex = this.findNextActivePlayer(0);
    return true;
  }

  /* ================== PLAYER ACTION ================== */

  playerAction(playerId, action) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.folded || this.finished) return;

    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;

      case 'call':
        this.pot += player.bet;
        break;

      case 'bet':
        if (action.amount > player.chips) return;
        player.chips -= action.amount;
        player.bet += action.amount;
        this.pot += action.amount;
        break;

      default:
        return;
    }

    this.advanceTurn();
  }

  /* ================== TURN FLOW ================== */

  advanceTurn() {
    if (this.checkHandFinished()) {
      this.finishHand();
      return;
    }

    const next = this.findNextActivePlayer(this.currentPlayerIndex + 1);
    if (next === null) {
      this.nextStage();
    } else {
      this.currentPlayerIndex = next;
    }
  }

  nextStage() {
    this.players.forEach(p => (p.bet = 0));

    if (this.stage === 'preflop') {
      this.stage = 'flop';
      this.deck.draw();
      this.communityCards.push(this.deck.draw(), this.deck.draw(), this.deck.draw());
    } else if (this.stage === 'flop') {
      this.stage = 'turn';
      this.deck.draw();
      this.communityCards.push(this.deck.draw());
    } else if (this.stage === 'turn') {
      this.stage = 'river';
      this.deck.draw();
      this.communityCards.push(this.deck.draw());
    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      this.finishHand();
      return;
    }

    this.currentPlayerIndex = this.findNextActivePlayer(0);
  }

  /* ================== FINISH HAND ================== */

  finishHand() {
    this.finished = true;

    const activePlayers = this.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      activePlayers[0].chips += this.pot;
      return;
    }

    const results = activePlayers.map(player => {
      const hand = HandEvaluator.evaluate([
        ...player.hand,
        ...this.communityCards
      ]);
      return { player, hand };
    });

    results.sort((a, b) =>
      HandEvaluator.compareHands(b.hand, a.hand)
    );

    const winner = results[0].player;
    winner.chips += this.pot;
  }

  /* ================== HELPERS ================== */

  checkHandFinished() {
    const active = this.players.filter(p => !p.folded);
    return active.length <= 1;
  }

  findNextActivePlayer(startIndex) {
    for (let i = 0; i < this.players.length; i++) {
      const index = (startIndex + i) % this.players.length;
      const p = this.players[index];
      if (!p.folded && p.chips > 0) return index;
    }
    return null;
  }

  /* ================== STATE ================== */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      communityCards: this.communityCards,
      currentPlayerIndex: this.currentPlayerIndex,
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
}

/* ❗❗❗ КЛЮЧЕВОЕ МЕСТО ❗❗❗ */
module.exports = GameState;
