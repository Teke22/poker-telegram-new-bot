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
      folded: false
    }));

    this.deck = new Deck();
    this.deck.shuffle();

    this.communityCards = [];
    this.pot = 0;

    this.stage = 'waiting'; // waiting | preflop | flop | turn | river | showdown
    this.currentPlayerIndex = 0;
    this.currentBet = 0;

    this.finished = false;
    this.winners = [];
  }

  /* ================= START GAME ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this.stage = 'preflop';
    this.finished = false;
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;

    this.players.forEach(p => {
      p.hand = [this.deck.draw(), this.deck.draw()];
      p.bet = 0;
      p.folded = false;
    });

    this.currentPlayerIndex = 0;
    return true;
  }

  /* ================= PLAYER ACTION ================= */

  playerAction(playerId, action) {
    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (player.folded) {
      this.nextPlayer();
      return;
    }

    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;

      case 'check':
        if (player.bet !== this.currentBet) {
          throw new Error('Cannot check');
        }
        break;

      case 'call': {
        const diff = this.currentBet - player.bet;
        if (diff > player.chips) throw new Error('Not enough chips');
        player.chips -= diff;
        player.bet += diff;
        this.pot += diff;
        break;
      }

      case 'bet': {
        const amount = action.amount;
        if (amount <= this.currentBet) throw new Error('Bet too small');
        if (amount > player.chips + player.bet) throw new Error('Not enough chips');

        const diff = amount - player.bet;
        player.chips -= diff;
        player.bet = amount;
        this.currentBet = amount;
        this.pot += diff;
        break;
      }

      default:
        throw new Error('Unknown action');
    }

    this.nextPlayer();
  }

  /* ================= TURN LOGIC ================= */

  nextPlayer() {
    if (this.onlyOneLeft()) {
      this.finishByFold();
      return;
    }

    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;

    if (this.bettingRoundFinished()) {
      this.nextStage();
    }
  }

  bettingRoundFinished() {
    return this.players
      .filter(p => !p.folded)
      .every(p => p.bet === this.currentBet);
  }

  onlyOneLeft() {
    return this.players.filter(p => !p.folded).length === 1;
  }

  /* ================= STAGES ================= */

  nextStage() {
    this.players.forEach(p => (p.bet = 0));
    this.currentBet = 0;

    if (this.stage === 'preflop') {
      this.communityCards.push(
        this.deck.draw(),
        this.deck.draw(),
        this.deck.draw()
      );
      this.stage = 'flop';
    } else if (this.stage === 'flop') {
      this.communityCards.push(this.deck.draw());
      this.stage = 'turn';
    } else if (this.stage === 'turn') {
      this.communityCards.push(this.deck.draw());
      this.stage = 'river';
    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      this.finishShowdown();
      return;
    }

    this.currentPlayerIndex = 0;
  }

  /* ================= FINISH ================= */

  finishByFold() {
    const winner = this.players.find(p => !p.folded);
    winner.chips += this.pot;
    this.winners = [winner];
    this.finished = true;
  }

  finishShowdown() {
    let best = null;
    let winners = [];

    this.players
      .filter(p => !p.folded)
      .forEach(p => {
        const hand = HandEvaluator.evaluate([
          ...p.hand,
          ...this.communityCards
        ]);

        if (!best || HandEvaluator.compareHands(hand, best.hand) > 0) {
          best = { player: p, hand };
          winners = [p];
        } else if (
          HandEvaluator.compareHands(hand, best.hand) === 0
        ) {
          winners.push(p);
        }
      });

    const winAmount = Math.floor(this.pot / winners.length);
    winners.forEach(w => (w.chips += winAmount));

    this.winners = winners;
    this.finished = true;
  }

  /* ================= STATES ================= */

  getPublicState() {
    return {
      stage: this.stage,
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
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
    const p = this.players.find(p => p.id === playerId);
    if (p) p.folded = true;
  }
}

module.exports = { GameState };
