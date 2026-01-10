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
      isBot: p.isBot || false
    }));

    this.deck = new Deck();
    this.communityCards = [];

    this.pot = 0;
    this.currentBet = 0;

    this.stage = 'waiting'; // waiting | preflop | flop | turn | river | showdown
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;

    this.finished = false;
  }

  /* ================= START GAME ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this.deck.shuffle();
    this.stage = 'preflop';
    this.finished = false;

    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;

    this.players.forEach(p => {
      p.hand = [];
      p.bet = 0;
      p.folded = false;
    });

    // Раздача 2 карт
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        if (player.chips > 0) {
          player.hand.push(this.deck.draw());
        }
      });
    }

    this.postBlinds();
    this.setFirstPlayer();

    return true;
  }

  /* ================= BLINDS ================= */

  postBlinds() {
    const sbIndex = (this.dealerIndex + 1) % this.players.length;
    const bbIndex = (this.dealerIndex + 2) % this.players.length;

    this.placeBet(sbIndex, 10);
    this.placeBet(bbIndex, 20);

    this.currentBet = 20;
  }

  placeBet(index, amount) {
    const player = this.players[index];
    const bet = Math.min(player.chips, amount);

    player.chips -= bet;
    player.bet += bet;
    this.pot += bet;
  }

  setFirstPlayer() {
    this.currentPlayerIndex = (this.dealerIndex + 3) % this.players.length;
  }

  /* ================= PLAYER ACTION ================= */

  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== playerId || player.folded) {
      throw new Error('Not your turn');
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
        this.placeBet(this.currentPlayerIndex, diff);
        break;
      }

      case 'bet':
      case 'raise': {
        const amount = action.amount;
        if (amount <= this.currentBet) {
          throw new Error('Invalid bet');
        }
        const diff = amount - player.bet;
        this.currentBet = amount;
        this.placeBet(this.currentPlayerIndex, diff);
        break;
      }

      default:
        throw new Error('Unknown action');
    }

    this.nextTurn();
  }

  /* ================= TURN FLOW ================= */

  nextTurn() {
    if (this.isBettingRoundComplete()) {
      this.nextStage();
      return;
    }

    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
    } while (this.players[this.currentPlayerIndex].folded);
  }

  isBettingRoundComplete() {
    return this.players
      .filter(p => !p.folded)
      .every(p => p.bet === this.currentBet);
  }

  resetBets() {
    this.players.forEach(p => (p.bet = 0));
    this.currentBet = 0;
  }

  /* ================= STAGES ================= */

  nextStage() {
    this.resetBets();

    switch (this.stage) {
      case 'preflop':
        this.communityCards.push(
          this.deck.draw(),
          this.deck.draw(),
          this.deck.draw()
        );
        this.stage = 'flop';
        break;

      case 'flop':
        this.communityCards.push(this.deck.draw());
        this.stage = 'turn';
        break;

      case 'turn':
        this.communityCards.push(this.deck.draw());
        this.stage = 'river';
        break;

      case 'river':
        this.stage = 'showdown';
        this.finishGame();
        return;
    }

    this.currentPlayerIndex =
      (this.dealerIndex + 1) % this.players.length;
  }

  /* ================= SHOWDOWN ================= */

  finishGame() {
    const activePlayers = this.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      activePlayers[0].chips += this.pot;
      this.finished = true;
      return;
    }

    const results = activePlayers.map(p => {
      const hand = HandEvaluator.evaluate([
        ...p.hand,
        ...this.communityCards
      ]);
      return { player: p, hand };
    });

    results.sort((a, b) =>
      HandEvaluator.compareHands(b.hand, a.hand)
    );

    const winner = results[0];
    winner.player.chips += this.pot;

    this.finished = true;
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      communityCards: this.communityCards,
      currentPlayerId:
        this.players[this.currentPlayerIndex]?.id || null,
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
