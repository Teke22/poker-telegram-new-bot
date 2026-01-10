const Deck = require('./deck');
const HandEvaluator = require('./handEvaluator');

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips ?? 1000,
      hand: [],
      folded: false,
      bet: 0,
      allIn: false
    }));

    this.deck = new Deck();
    this.deck.shuffle();

    this.communityCards = [];
    this.pot = 0;

    this.stage = 'waiting'; // waiting | preflop | flop | turn | river | showdown
    this.currentPlayerIndex = 0;
    this.finished = false;
  }

  /* ================== START GAME ================== */
  startGame() {
    if (this.players.length < 2) return false;

    this.stage = 'preflop';
    this.finished = false;
    this.pot = 0;
    this.communityCards = [];

    this.players.forEach(p => {
      p.hand = [];
      p.folded = false;
      p.bet = 0;
      p.allIn = false;
    });

    // Раздача 2 карт каждому
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        player.hand.push(this.deck.draw());
      });
    }

    this.currentPlayerIndex = 0;
    return true;
  }

  /* ================== PLAYER ACTION ================== */
  playerAction(playerId, action) {
    if (this.finished) return;

    const player = this.players.find(p => p.id === playerId);
    if (!player || player.folded) return;

    switch (action.type) {
      case 'fold':
        player.folded = true;
        break;

      case 'call':
      case 'check':
        break;

      case 'bet':
        const amount = Math.min(action.amount, player.chips);
        player.chips -= amount;
        player.bet += amount;
        this.pot += amount;
        if (player.chips === 0) player.allIn = true;
        break;
    }

    this.nextTurn();
  }

  /* ================== NEXT TURN ================== */
  nextTurn() {
    const activePlayers = this.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      this.finishGame();
      return;
    }

    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;
  }

  /* ================== FINISH ================== */
  finishGame() {
    this.stage = 'showdown';
    this.finished = true;

    const contenders = this.players.filter(p => !p.folded);

    const results = contenders.map(p => ({
      player: p,
      hand: HandEvaluator.evaluate([...p.hand, ...this.communityCards])
    }));

    results.sort((a, b) =>
      HandEvaluator.compareHands(b.hand, a.hand)
    );

    const winner = results[0].player;
    winner.chips += this.pot;

    this.winners = [{
      id: winner.id,
      name: winner.name,
      hand: results[0].hand
    }];
  }

  /* ================== STATES ================== */
  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      communityCards: this.communityCards,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      finished: this.finished,
      winners: this.winners || []
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

/* ✅ ВАЖНО: ПРАВИЛЬНЫЙ ЭКСПОРТ */
module.exports = { GameState };
