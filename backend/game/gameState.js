const Deck = require('./deck');
const HandEvaluator = require('./handEvaluator');

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips ?? 1000,
      hand: [],
      folded: false,
      isBot: p.isBot || false
    }));

    this.stage = 'waiting'; // waiting | preflop | flop | turn | river | showdown | finished
    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;
    this.currentPlayerIndex = 0;
    this.finished = false;
    this.winners = [];
  }

  /* =========================
     GAME FLOW
  ========================= */

  startGame() {
    if (this.players.length < 2) return false;

    this.stage = 'preflop';
    this.finished = false;
    this.deck.shuffle();

    // reset players
    this.players.forEach(p => {
      p.hand = [];
      p.folded = false;
    });

    // deal 2 cards to each
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        player.hand.push(this.deck.draw());
      });
    }

    return true;
  }

  nextStage() {
    if (this.stage === 'preflop') {
      this.stage = 'flop';
      this.communityCards.push(
        this.deck.draw(),
        this.deck.draw(),
        this.deck.draw()
      );
    } else if (this.stage === 'flop') {
      this.stage = 'turn';
      this.communityCards.push(this.deck.draw());
    } else if (this.stage === 'turn') {
      this.stage = 'river';
      this.communityCards.push(this.deck.draw());
    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      this.resolveShowdown();
    }
  }

  /* =========================
     PLAYER ACTIONS
  ========================= */

  playerAction(playerId, action) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.folded || this.finished) return;

    if (action.type === 'fold') {
      player.folded = true;
    }

    if (action.type === 'check') {
      // nothing yet
    }

    // если остался один игрок — он победил
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.winners = [activePlayers[0]];
      this.finished = true;
      this.stage = 'finished';
      return;
    }

    this.nextStage();
  }

  playerLeave(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    player.folded = true;

    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.winners = [activePlayers[0]];
      this.finished = true;
      this.stage = 'finished';
    }
  }

  /* =========================
     SHOWDOWN
  ========================= */

  resolveShowdown() {
    const activePlayers = this.players.filter(p => !p.folded);

    let bestHand = null;
    let winners = [];

    activePlayers.forEach(player => {
      const cards = [...player.hand, ...this.communityCards];
      const hand = HandEvaluator.evaluate(cards);

      if (!bestHand) {
        bestHand = hand;
        winners = [player];
      } else {
        const cmp = HandEvaluator.compareHands(hand, bestHand);
        if (cmp > 0) {
          bestHand = hand;
          winners = [player];
        } else if (cmp === 0) {
          winners.push(player);
        }
      }
    });

    this.winners = winners;
    this.finished = true;
    this.stage = 'finished';
  }

  /* =========================
     STATES
  ========================= */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      communityCards: this.communityCards,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        folded: p.folded,
        hasCards: p.hand.length > 0
      })),
      winners: this.winners.map(w => ({
        id: w.id,
        name: w.name
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    return {
      hand: player.hand
    };
  }
}

module.exports = { GameState };
