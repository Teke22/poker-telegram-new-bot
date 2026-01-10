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
    this.pot = 0;

    this.stage = 'waiting'; // waiting | preflop | showdown | finished
    this.currentPlayerIndex = 0;
    this.finished = false;
    this.winners = [];
  }

  /* ================= GAME START ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this.deck.shuffle();

    // раздаём по 2 карты
    this.players.forEach(player => {
      player.hand = [
        this.deck.draw(),
        this.deck.draw()
      ];
    });

    this.stage = 'preflop';
    this.currentPlayerIndex = 0;
    this.finished = false;
    this.winners = [];

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

    if (action.type === 'bet') {
      const amount = action.amount || 0;
      if (amount > player.chips) {
        throw new Error('Not enough chips');
      }

      player.chips -= amount;
      player.bet += amount;
      this.pot += amount;
    }

    this._nextPlayerOrFinish();
  }

  /* ================= TURN LOGIC ================= */

  _nextPlayerOrFinish() {
    const activePlayers = this.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      // победа по фолдам
      const winner = activePlayers[0];
      winner.chips += this.pot;

      this.winners = [winner.id];
      this.finished = true;
      this.stage = 'finished';
      return;
    }

    // следующий игрок
    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;

    // если все сходили → showdown
    if (this.currentPlayerIndex === 0) {
      this._showdown();
    }
  }

  /* ================= SHOWDOWN ================= */

  _showdown() {
    let bestHand = null;
    let winners = [];

    this.players.forEach(player => {
      if (player.folded) return;

      const evaluated = HandEvaluator.evaluate(
        player.hand.map(c => ({
          rank: c.rank,
          suit: c.suit
        }))
      );

      if (!bestHand || HandEvaluator.compareHands(evaluated, bestHand) > 0) {
        bestHand = evaluated;
        winners = [player];
      } else if (HandEvaluator.compareHands(evaluated, bestHand) === 0) {
        winners.push(player);
      }
    });

    const winAmount = Math.floor(this.pot / winners.length);

    winners.forEach(w => {
      w.chips += winAmount;
      this.winners.push(w.id);
    });

    this.finished = true;
    this.stage = 'finished';
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      currentPlayerId:
        this.players[this.currentPlayerIndex]?.id || null,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        folded: p.folded,
        bet: p.bet
      })),
      winners: this.winners
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    return {
      hand: player.hand
    };
  }

  playerLeave(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.folded = true;
    }
  }
}

/* 🔴 ВАЖНО: ИМЕННО ТАК */
module.exports = { GameState };
