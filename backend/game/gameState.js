const Deck = require('./deck');
const HandEvaluator = require('./handEvaluator');

class GameState {
  constructor(roomId, players) {
    this.roomId = roomId;

    this.players = players.map(p => ({
      id: p.id,
      socketId: p.socketId,
      chips: 1000,
      hand: [],
      folded: false,
      bet: 0
    }));

    this.deck = null;
    this.communityCards = [];
    this.pot = 0;
    this.currentPlayerIndex = 0;
    this.stage = 'preflop'; // preflop | flop | turn | river | showdown
  }

  /** === НАЧАЛО НОВОЙ РАЗДАЧИ === */
  startGame() {
    console.log(`🔄 Starting new hand in ${this.roomId}`);

    this.deck = new Deck();
    this.deck.shuffle();

    this.communityCards = [];
    this.pot = 0;
    this.stage = 'preflop';

    // Сброс игроков
    this.players.forEach(p => {
      p.hand = [];
      p.folded = false;
      p.bet = 0;
    });

    // Раздача по 2 карты
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        player.hand.push(this.deck.deal());
      });
    }
  }

  /** === ПЕРЕХОД ПО УЛИЦАМ === */
  nextStage() {
    if (this.stage === 'preflop') {
      this.stage = 'flop';
      this.communityCards.push(
        this.deck.deal(),
        this.deck.deal(),
        this.deck.deal()
      );
    } else if (this.stage === 'flop') {
      this.stage = 'turn';
      this.communityCards.push(this.deck.deal());
    } else if (this.stage === 'turn') {
      this.stage = 'river';
      this.communityCards.push(this.deck.deal());
    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      return this.resolveShowdown();
    }
  }

  /** === ОПРЕДЕЛЕНИЕ ПОБЕДИТЕЛЯ === */
  resolveShowdown() {
    const activePlayers = this.players.filter(p => !p.folded);

    const results = activePlayers.map(player => {
      const cards = [...player.hand, ...this.communityCards];
      const hand = HandEvaluator.evaluate(cards);

      return {
        playerId: player.id,
        hand
      };
    });

    results.sort((a, b) =>
      HandEvaluator.compareHands(a.hand, b.hand)
    );

    const winner = results[0];

    return {
      winnerId: winner.playerId,
      hand: winner.hand,
      pot: this.pot
    };
  }

  /** === СЕРИАЛИЗАЦИЯ ДЛЯ КЛИЕНТА === */
  getPublicState() {
    return {
      roomId: this.roomId,
      stage: this.stage,
      pot: this.pot,
      communityCards: this.communityCards,
      players: this.players.map(p => ({
        id: p.id,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        handSize: p.hand.length
      }))
    };
  }
}

module.exports = GameState;
