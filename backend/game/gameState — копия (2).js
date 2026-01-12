// backend/game/gameState.js
const { Hand } = require('pokersolver');

const SMALL_BLIND = 10;
const BIG_BLIND = 20;

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      hand: [],
      bet: 0,
      folded: false,
      allIn: false,
      acted: false,
      lastHand: null
    }));

    this.deck = [];
    this.communityCards = [];
    this.pot = 0;

    this.stage = 'preflop';
    this.currentBet = 0;
    this.lastRaise = BIG_BLIND;

    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;

    this.finished = false;
    this.winners = [];
    this.winningHandName = null;
  }

  /* ================= INIT ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this._initDeck();
    this._shuffle();

    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastRaise = BIG_BLIND;
    this.stage = 'preflop';
    this.finished = false;
    this.winners = [];
    this.winningHandName = null;

    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.bet = 0;
      p.folded = false;
      p.allIn = false;
      p.acted = false;
      p.lastHand = null;
    });

    this._postBlinds();

    // первый ход — после BB
    this.currentPlayerIndex = this._nextActivePlayer(
      this._nextActivePlayer(this.dealerIndex)
    );

    return true;
  }

  _postBlinds() {
    const sbIndex = this._nextActivePlayer(this.dealerIndex);
    const bbIndex = this._nextActivePlayer(sbIndex);

    this._postBlind(sbIndex, SMALL_BLIND);
    this._postBlind(bbIndex, BIG_BLIND);

    this.currentBet = BIG_BLIND;
  }

  _postBlind(index, amount) {
    const p = this.players[index];
    const blind = Math.min(amount, p.chips);

    p.chips -= blind;
    p.bet += blind;
    this.pot += blind;

    if (p.chips === 0) p.allIn = true;
  }

  /* ================= ACTIONS ================= */

  playerAction(playerId, action) {
    if (this.finished) throw new Error('Hand finished');

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (typeof action === 'string') action = { type: action };

    switch (action.type) {
      case 'fold':
        player.folded = true;
        player.acted = true;
        break;

      case 'check':
        if (this.currentBet !== player.bet) {
          throw new Error('Cannot check');
        }
        player.acted = true;
        break;

      case 'call': {
        const toCall = this.currentBet - player.bet;
        const amount = Math.min(toCall, player.chips);

        player.chips -= amount;
        player.bet += amount;
        this.pot += amount;

        if (player.chips === 0) player.allIn = true;
        player.acted = true;
        break;
      }

      case 'bet':
      case 'raise': {
        const amount = action.amount;

        const minRaise = this.currentBet + this.lastRaise;
        if (amount < minRaise) {
          throw new Error(`Minimum raise is ${minRaise}`);
        }

        const diff = amount - player.bet;
        if (diff > player.chips) {
          throw new Error('Not enough chips');
        }

        player.chips -= diff;
        player.bet = amount;
        this.pot += diff;

        this.lastRaise = amount - this.currentBet;
        this.currentBet = amount;

        this.players.forEach(p => {
          if (!p.folded && !p.allIn) p.acted = false;
        });

        player.acted = true;
        if (player.chips === 0) player.allIn = true;
        break;
      }

      default:
        throw new Error('Unknown command');
    }

    if (this._onlyOneLeft()) {
      this._finishByFold();
      return;
    }

    if (this._bettingRoundFinished()) {
      this._nextStage();
      return;
    }

    this._moveToNextPlayer();
  }

  /* ================= FLOW ================= */

  _nextStage() {
    this.players.forEach(p => {
      p.bet = 0;
      p.acted = false;
    });

    this.currentBet = 0;
    this.lastRaise = BIG_BLIND;

    if (this.stage === 'preflop') {
      this.stage = 'flop';
      this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
    } else if (this.stage === 'flop') {
      this.stage = 'turn';
      this.communityCards.push(this.deck.pop());
    } else if (this.stage === 'turn') {
      this.stage = 'river';
      this.communityCards.push(this.deck.pop());
    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      this.finishShowdown();
      return;
    }

    this.currentPlayerIndex = this._nextActivePlayer(this.dealerIndex);
  }

  finishShowdown() {
    const activePlayers = this.players.filter(p => !p.folded);

    const solved = activePlayers.map(p => {
      const cards = [...p.hand, ...this.communityCards].map(
        c => c.rank + c.suit
      );
      p.lastHand = Hand.solve(cards);
      return p.lastHand;
    });

    const winningHands = Hand.winners(solved);

    this.winners = activePlayers.filter(p =>
      winningHands.includes(p.lastHand)
    );

    this.winningHandName = winningHands[0].name;

    const share = Math.floor(this.pot / this.winners.length);
    this.winners.forEach(w => (w.chips += share));

    this.finished = true;
  }

  _finishByFold() {
    const winner = this.players.find(p => !p.folded);
    if (winner) {
      winner.chips += this.pot;
      this.winners = [winner];
      this.winningHandName = 'Fold';
    }
    this.finished = true;
  }

  /* ================= HELPERS ================= */

  _onlyOneLeft() {
    return this.players.filter(p => !p.folded).length === 1;
  }

  _bettingRoundFinished() {
    return this.players.every(p =>
      p.folded || p.allIn || (p.acted && p.bet === this.currentBet)
    );
  }

  _moveToNextPlayer() {
    this.currentPlayerIndex = this._nextActivePlayer(this.currentPlayerIndex);
  }

  _nextActivePlayer(from) {
    let i = from;
    do {
      i = (i + 1) % this.players.length;
    } while (this.players[i].folded || this.players[i].allIn);
    return i;
  }

  _initDeck() {
    const suits = ['s', 'h', 'd', 'c'];
    const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
    this.deck = [];
    for (const s of suits) {
      for (const r of ranks) {
        this.deck.push({ rank: r, suit: s });
      }
    }
  }

  _shuffle() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  /* ================= STATE ================= */

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      currentBet: this.currentBet,
      communityCards: this.communityCards,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      finished: this.finished,
      winningHandName: this.winningHandName,
      winners: this.winners.map(w => ({ id: w.id, name: w.name })),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        showHand: this.finished ? p.hand : []
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const p = this.players.find(x => x.id === playerId);
    return p ? { hand: p.hand } : null;
  }
}

module.exports = { GameState };
