const Deck = require('./deck');
const HandEvaluator = require('./handEvaluator');
const {
  SMALL_BLIND,
  BIG_BLIND,
  NEXT_HAND_DELAY
} = require('./config');

class GameState {
  constructor(players) {
    this.players = players;

    this.gameStatus = 'waiting';
    this.lastHandResult = null;

    this.currentPlayerIndex = 0;
    this.stage = 'preflop';

    this.nextHandTimer = null;

    // 🔔 несколько подписчиков
    this.turnListeners = [];

    this.resetHand();
  }

  /* ---------- EVENTS ---------- */

  onTurn(listener) {
    this.turnListeners.push(listener);
  }

  emitTurnChange() {
    this.turnListeners.forEach(fn =>
      fn(this.currentPlayerIndex)
    );
  }

  /* ---------- RESET ---------- */

  resetHand() {
    this.deck = new Deck();
    this.board = [];
    this.pot = 0;

    this.stage = 'preflop';
    this.currentBet = 0;
    this.currentPlayerIndex = 0;

    this.players.forEach(p => p.resetForNewRound());
  }

  /* ---------- START ---------- */

  startHand() {
    if (this.gameStatus === 'playing') return;

    this.resetHand();
    this.gameStatus = 'playing';

    this.dealHoleCards();
    this.postBlinds();

    this.emitTurnChange();
  }

  /* ---------- DEAL ---------- */

  dealHoleCards() {
    for (let i = 0; i < 2; i++) {
      for (const player of this.players) {
        player.receiveCard(this.deck.deal());
      }
    }
  }

  /* ---------- BLINDS ---------- */

  postBlinds() {
    const sb = this.players[0];
    const bb = this.players[1];

    this.pot += sb.bet(SMALL_BLIND);
    this.pot += bb.bet(BIG_BLIND);

    this.currentBet = BIG_BLIND;
    this.currentPlayerIndex = 0;
  }

  /* ---------- ACTION ---------- */

  playerAction(action, amount = 0) {
    if (this.gameStatus !== 'playing') return;

    const player = this.players[this.currentPlayerIndex];
    if (player.status !== 'active') {
      this.nextPlayer();
      return;
    }

    switch (action) {
      case 'fold':
        player.fold();
        break;

      case 'check':
        if (player.currentBet !== this.currentBet)
          throw new Error('Нельзя чекать');
        break;

      case 'call':
        this.pot += player.bet(
          this.currentBet - player.currentBet
        );
        break;

      case 'bet':
        if (this.currentBet !== 0)
          throw new Error('Нельзя бетить');
        this.currentBet = amount;
        this.pot += player.bet(amount);
        break;
    }

    if (this.getActivePlayers().length === 1) {
      this.finishHand();
      return;
    }

    this.isBettingRoundOver()
      ? this.nextStage()
      : this.nextPlayer();
  }

  /* ---------- FLOW ---------- */

  nextPlayer() {
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) %
        this.players.length;
    } while (
      this.players[this.currentPlayerIndex].status !== 'active'
    );

    this.emitTurnChange();
  }

  nextStage() {
    this.players.forEach(p => (p.currentBet = 0));
    this.currentBet = 0;

    switch (this.stage) {
      case 'preflop':
        this.board.push(
          this.deck.deal(),
          this.deck.deal(),
          this.deck.deal()
        );
        this.stage = 'flop';
        break;
      case 'flop':
        this.board.push(this.deck.deal());
        this.stage = 'turn';
        break;
      case 'turn':
        this.board.push(this.deck.deal());
        this.stage = 'river';
        break;
      case 'river':
        this.finishHand();
        return;
    }

    this.emitTurnChange();
  }

  getActivePlayers() {
    return this.players.filter(p => p.status === 'active');
  }

  isBettingRoundOver() {
    return this.players.every(
      p => p.status !== 'active' || p.currentBet === this.currentBet
    );
  }

  /* ---------- FINISH ---------- */

  determineWinner() {
    return this.players
      .filter(p => p.status !== 'folded')
      .map(p => ({
        player: p,
        hand: HandEvaluator.evaluate([
          ...p.hand,
          ...this.board
        ])
      }))
      .sort((a, b) => b.hand.rank - a.hand.rank)[0];
  }

  finishHand() {
    const winner =
      this.getActivePlayers().length === 1
        ? this.getActivePlayers()[0]
        : this.determineWinner().player;

    winner.chips += this.pot;

    console.log(
      `🏆 Победитель: ${winner.name}, банк ${this.pot}`
    );

    this.gameStatus = 'finished';

    setTimeout(() => this.startHand(), NEXT_HAND_DELAY);
  }
}

module.exports = GameState;
