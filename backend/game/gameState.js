const Deck = require('./deck');
const HandEvaluator = require('./handEvaluator');

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips ?? 1000,
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
    this.currentBet = 0;
    this.finished = false;
  }

  /* ================= START GAME ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this.deck.shuffle();

    // reset
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.finished = false;
    this.stage = 'preflop';

    this.players.forEach(p => {
      p.hand = [];
      p.bet = 0;
      p.folded = false;
      p.allIn = false;

      // ⬇️ ВАЖНО: deck.draw() — именно так в твоём deck.js
      p.hand.push(this.deck.draw());
      p.hand.push(this.deck.draw());
    });

    this.currentPlayerIndex = 0;
    return true;
  }

  /* ================= PLAYER ACTION ================= */

  playerAction(playerId, action) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.folded || this.finished) return;

    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;

      case 'call': {
        const toCall = this.currentBet - player.bet;
        const amount = Math.min(toCall, player.chips);
        player.chips -= amount;
        player.bet += amount;
        this.pot += amount;
        if (player.chips === 0) player.allIn = true;
        break;
      }

      case 'raise': {
        const raiseAmount = action.amount;
        if (raiseAmount <= 0) return;

        const total = this.currentBet - player.bet + raiseAmount;
        const amount = Math.min(total, player.chips);

        player.chips -= amount;
        player.bet += amount;
        this.pot += amount;
        this.currentBet = player.bet;

        if (player.chips === 0) player.allIn = true;
        break;
      }
    }

    this.nextTurn();
  }

  /* ================= TURN LOGIC ================= */

  nextTurn() {
    if (this.isBettingRoundComplete()) {
      this.nextStage();
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

  isBettingRoundComplete() {
    return this.players.every(
      p =>
        p.folded ||
        p.allIn ||
        p.bet === this.currentBet
    );
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
      this.finishGame();
      return;
    }

    this.currentPlayerIndex = 0;
  }

  /* ================= SHOWDOWN ================= */

  finishGame() {
    const activePlayers = this.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      activePlayers[0].chips += this.pot;
      this.finished = true;
      return;
    }

    const hands = activePlayers.map(p => ({
      player: p,
      hand: HandEvaluator.evaluate([
        ...p.hand,
        ...this.communityCards
      ])
    }));

    hands.sort((a, b) =>
      HandEvaluator.compareHands(b.hand, a.hand)
    );

    const best = hands[0].hand;
    const winners = hands.filter(h =>
      HandEvaluator.compareHands(h.hand, best) === 0
    );

    const winAmount = Math.floor(this.pot / winners.length);
    winners.forEach(w => (w.player.chips += winAmount));

    this.finished = true;
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      currentPlayerId:
        this.players[this.currentPlayerIndex]?.id,
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
    const player = this.players.find(p => p.id === playerId);
    if (player) player.folded = true;
  }
}

module.exports = GameState;
