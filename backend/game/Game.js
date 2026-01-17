const Deck = require('./engine/Deck');
const BettingEngine = require('./engine/BettingEngine');
const HandEvaluator = require('./engine/HandEvaluator');
const TurnManager = require('./engine/TurnManager');

class Game {
  constructor(players) {
    this.players = players;
    this.deck = new Deck();
    this.betting = new BettingEngine(this);
    this.turns = new TurnManager(this);
    this.evaluator = new HandEvaluator();

    this.stage = 'preflop';
    this.communityCards = [];
    this.pot = 0;
    this.finished = false;
  }

  start() {
    this.deck.shuffle();
    this.players.forEach(p => p.deal(this.deck.draw(2)));
    this.turns.start();
  }

  applyAction(playerId, action) {
    this.betting.apply(playerId, action);
    this.turns.next();
  }

  finish() {
    this.finished = true;
    return this.evaluator.evaluate(this.players, this.communityCards);
  }

  getPublicState() {
    return {
      stage: this.stage,
      pot: this.pot,
      players: this.players.map(p => p.public()),
      communityCards: this.communityCards,
      currentPlayerId: this.turns.currentPlayerId()
    };
  }
}

module.exports = Game;
