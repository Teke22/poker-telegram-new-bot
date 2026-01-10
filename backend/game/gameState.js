// backend/game/gameState.js

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
      acted: false
    }));

    this.deck = [];
    this.communityCards = [];
    this.pot = 0;

    this.stage = 'preflop';
    this.currentBet = 0;

    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;

    this.finished = false;
    this.winners = [];
  }

  /* ================= INIT ================= */

  startGame() {
    if (this.players.length < 2) return false;

    this._initDeck();
    this._shuffle();

    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.stage = 'preflop';
    this.finished = false;
    this.winners = [];

    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.bet = 0;
      p.folded = false;
      p.allIn = false;
      p.acted = false;
    });

    this.currentPlayerIndex = this._nextActivePlayer(this.dealerIndex);
    return true;
  }

  /* ================= ACTIONS ================= */

  playerAction(playerId, action) {
    if (this.finished) throw new Error('Hand finished');

    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (player.folded || player.allIn) {
      throw new Error('Player cannot act');
    }

    if (typeof action === 'string') {
      action = { type: action };
    }

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
        if (amount <= this.currentBet) {
          throw new Error('Bet too small');
        }

        const diff = amount - player.bet;
        if (diff > player.chips) {
          throw new Error('Not enough chips');
        }

        player.chips -= diff;
        player.bet = amount;
        this.pot += diff;
        this.currentBet = amount;

        if (player.chips === 0) player.allIn = true;

        this.players.forEach(p => {
          if (!p.folded && !p.allIn) p.acted = false;
        });

        player.acted = true;
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

  _moveToNextPlayer() {
    this.currentPlayerIndex = this._nextActivePlayer(this.currentPlayerIndex);
  }

  _bettingRoundFinished() {
    return this.players.every(p => {
      if (p.folded || p.allIn) return true;
      return p.acted && p.bet === this.currentBet;
    });
  }

  _nextStage() {
    this.players.forEach(p => {
      p.bet = 0;
      p.acted = false;
    });
    this.currentBet = 0;

    if (this.stage === 'preflop') {
      this.stage = 'flop';
      this.communityCards.push(
        this.deck.pop(),
        this.deck.pop(),
        this.deck.pop()
      );
    } else if (this.stage === 'flop') {
      this.stage = 'turn';
      this.communityCards.push(this.deck.pop());
    } else if (this.stage === 'turn') {
      this.stage = 'river';
      this.communityCards.push(this.deck.pop());
    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      this.finished = true;
      return;
    }

    this.currentPlayerIndex = this._nextActivePlayer(this.dealerIndex);
  }

  _finishByFold() {
    const winner = this.players.find(p => !p.folded);
    if (winner) {
      winner.chips += this.pot;
      this.winners = [winner];
    }
    this.finished = true;
    this.stage = 'showdown';
  }

  /* ================= HELPERS ================= */

  _onlyOneLeft() {
    return this.players.filter(p => !p.folded).length === 1;
  }

  _nextActivePlayer(from) {
    let i = from;
    do {
      i = (i + 1) % this.players.length;
    } while (this.players[i].folded || this.players[i].allIn);
    return i;
  }

  _initDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
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
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      finished: this.finished,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        // 👇 КАРТЫ ТОЛЬКО НА ШОУДАУНЕ
        hand: this.stage === 'showdown' ? p.hand : null
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (!p) return null;
    return { hand: p.hand };
  }

  playerLeave(playerId) {
    const p = this.players.find(x => x.id === playerId);
    if (p) p.folded = true;
  }
}

module.exports = { GameState };
