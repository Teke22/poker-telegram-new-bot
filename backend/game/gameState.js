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
      bet: 0,
      isBot: p.isBot || false
    }));

    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;

    this.stage = 'waiting'; // waiting | preflop | flop | turn | river | showdown
    this.currentPlayerIndex = 0;
    this.currentBet = 0;
    this.finished = false;
  }

  /* ---------------- START GAME ---------------- */

  startGame() {
    if (this.players.length < 2) return false;

    this.deck.shuffle();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.finished = false;

    this.players.forEach(p => {
      p.hand = [];
      p.folded = false;
      p.bet = 0;
    });

    // Раздаём по 2 карты
    this.players.forEach(player => {
      player.hand.push(this.deck.drawCard());
      player.hand.push(this.deck.drawCard());
    });

    this.stage = 'preflop';
    this.currentPlayerIndex = 0;

    return true;
  }

  /* ---------------- PLAYER ACTION ---------------- */

  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.players.find(p => p.id === playerId);
    if (!player || player.folded) return;

    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;

      case 'check':
        if (player.bet !== this.currentBet) {
          throw new Error('Нельзя чекать');
        }
        break;

      case 'call': {
        const diff = this.currentBet - player.bet;
        if (diff > player.chips) throw new Error('Недостаточно фишек');
        player.chips -= diff;
        player.bet += diff;
        this.pot += diff;
        break;
      }

      case 'bet':
      case 'raise': {
        const amount = action.amount;
        if (amount <= this.currentBet) throw new Error('Ставка слишком маленькая');
        const diff = amount - player.bet;
        if (diff > player.chips) throw new Error('Недостаточно фишек');

        player.chips -= diff;
        player.bet += diff;
        this.pot += diff;
        this.currentBet = amount;
        break;
      }

      default:
        throw new Error('Неизвестное действие');
    }

    this.nextPlayer();
  }

  /* ---------------- TURN LOGIC ---------------- */

  nextPlayer() {
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
    const activePlayers = this.players.filter(p => !p.folded);
    return activePlayers.every(p => p.bet === this.currentBet);
  }

  /* ---------------- STAGES ---------------- */

  nextStage() {
    this.players.forEach(p => (p.bet = 0));
    this.currentBet = 0;

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
      this.finishGame();
      return;
    }

    this.currentPlayerIndex = 0;
  }

  /* ---------------- SHOWDOWN ---------------- */

  finishGame() {
    const activePlayers = this.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      activePlayers[0].chips += this.pot;
      this.finished = true;
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

    const bestHand = results[0].hand;
    const winners = results.filter(
      r => HandEvaluator.compareHands(r.hand, bestHand) === 0
    );

    const winAmount = Math.floor(this.pot / winners.length);
    winners.forEach(w => {
      w.player.chips += winAmount;
    });

    this.finished = true;
  }

  /* ---------------- STATE HELPERS ---------------- */

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
    const player = this.players.find(p => p.id === playerId);
    if (player) player.folded = true;
  }
}

module.exports = { GameState };
