const Deck = require('./deck');
const HandEvaluator = require('./handEvaluator');

class GameState {
  constructor(roomId, players) {
    this.roomId = roomId;

    // players: Map<socketId, player>
    this.players = players;

    this.deck = new Deck();
    this.deck.shuffle();

    this.communityCards = [];
    this.pot = 0;

    this.currentTurnIndex = 0;
    this.playerOrder = Array.from(players.keys());

    this.stage = 'preflop'; // preflop | flop | turn | river | showdown
  }

  /* ==========================
     START GAME
  ========================== */
  startGame() {
    // очистка на всякий случай
    this.communityCards = [];
    this.pot = 0;
    this.stage = 'preflop';

    // раздаём по 2 карты каждому
    this.playerOrder.forEach((socketId) => {
      const player = this.players.get(socketId);
      player.hand = [
        this.deck.drawCard(),
        this.deck.drawCard()
      ];
      player.folded = false;
      player.bet = 0;
    });

    this.currentTurnIndex = 0;
  }

  /* ==========================
     TURN MANAGEMENT
  ========================== */
  getCurrentPlayerId() {
    return this.playerOrder[this.currentTurnIndex];
  }

  nextTurn() {
    do {
      this.currentTurnIndex =
        (this.currentTurnIndex + 1) % this.playerOrder.length;

      const player = this.players.get(this.getCurrentPlayerId());
      if (!player.folded) break;

    } while (true);
  }

  /* ==========================
     ACTIONS
  ========================== */
  playerAction(socketId, action, amount = 0) {
    const player = this.players.get(socketId);
    if (!player || player.folded) return;

    switch (action) {
      case 'fold':
        player.folded = true;
        break;

      case 'call':
        this.pot += amount;
        player.bet += amount;
        break;

      case 'raise':
        this.pot += amount;
        player.bet += amount;
        break;
    }

    this.nextTurn();
  }

  /* ==========================
     STAGES
  ========================== */
  nextStage() {
    if (this.stage === 'preflop') {
      this.communityCards.push(
        this.deck.drawCard(),
        this.deck.drawCard(),
        this.deck.drawCard()
      );
      this.stage = 'flop';

    } else if (this.stage === 'flop') {
      this.communityCards.push(this.deck.drawCard());
      this.stage = 'turn';

    } else if (this.stage === 'turn') {
      this.communityCards.push(this.deck.drawCard());
      this.stage = 'river';

    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      return this.showdown();
    }

    this.currentTurnIndex = 0;
  }

  /* ==========================
     SHOWDOWN
  ========================== */
  showdown() {
    let bestHand = null;
    let winnerId = null;

    this.playerOrder.forEach((socketId) => {
      const player = this.players.get(socketId);
      if (player.folded) return;

      const hand = HandEvaluator.evaluate([
        ...player.hand,
        ...this.communityCards
      ]);

      if (
        !bestHand ||
        HandEvaluator.compareHands(hand, bestHand) > 0
      ) {
        bestHand = hand;
        winnerId = socketId;
      }
    });

    return {
      winnerId,
      pot: this.pot
    };
  }
}

module.exports = GameState;
