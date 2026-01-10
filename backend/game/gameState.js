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
    this.currentBet = 0;

    this.currentPlayerIndex = 0;
    this.finished = false;

    this.stage = 'playing'; // позже: flop / turn / river
  }

  /* ================= START ================= */

  startGame() {
    this.deck.shuffle();

    this.players.forEach(p => {
      p.hand = [this.deck.draw(), this.deck.draw()];
      p.folded = false;
      p.bet = 0;
    });

    this.currentPlayerIndex = 0;
    this.currentBet = 0;
    this.pot = 0;
    this.finished = false;

    return true;
  }

  /* ================= HELPERS ================= */

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.players.length;
    } while (this.currentPlayer.folded);

    // если все кроме одного сфолдили
    const active = this.players.filter(p => !p.folded);
    if (active.length === 1) {
      active[0].chips += this.pot;
      this.finished = true;
    }
  }

  allBetsEqual() {
    const active = this.players.filter(p => !p.folded);
    return active.every(p => p.bet === this.currentBet);
  }

  /* ================= ACTIONS ================= */

  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.currentPlayer;
    if (player.id !== playerId) {
      throw new Error('Not your turn');
    }

    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;

      case 'check':
        if (this.currentBet > 0) {
          throw new Error('Cannot check, bet exists');
        }
        break;

      case 'bet': {
        const amount = Number(action.amount);
        if (amount <= 0) throw new Error('Invalid bet');
        if (player.chips < amount) throw new Error('Not enough chips');

        player.chips -= amount;
        player.bet += amount;
        this.currentBet = amount;
        this.pot += amount;
        break;
      }

      case 'call': {
        const toCall = this.currentBet - player.bet;
        if (toCall <= 0) throw new Error('Nothing to call');
        if (player.chips < toCall) throw new Error('Not enough chips');

        player.chips -= toCall;
        player.bet += toCall;
        this.pot += toCall;
        break;
      }

      default:
        throw new Error('Unknown action');
    }

    // если все уравняли — временно завершаем раздачу
    if (this.allBetsEqual()) {
      this.finished = true;
      return;
    }

    this.nextPlayer();
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerId: this.currentPlayer.id,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        folded: p.folded,
        bet: p.bet
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const p = this.players.find(p => p.id === playerId);
    if (!p) return null;
    return { hand: p.hand };
  }

  playerLeave(playerId) {
    const p = this.players.find(p => p.id === playerId);
    if (p) p.folded = true;
  }
}

module.exports = GameState;
