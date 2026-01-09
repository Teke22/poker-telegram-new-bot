const HandEvaluator = require('./handEvaluator');
const Deck = require('./deck');
const config = require('../config');

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips ?? config.START_CHIPS,
      hand: [],
      folded: false,
      allIn: false,
      bet: 0,
      hasActed: false,
      position: null // Добавляем позицию за столом
    }));

    this.deck = new Deck();
    this.communityCards = [];
    this.stage = 'waiting'; // waiting, preflop, flop, turn, river, showdown
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.finished = false;
    this.roundFinished = false;
    this.actionsInCurrentStage = 0;

    this.pot = 0;
    this.currentBet = 0;
    this.smallBlind = config.SMALL_BLIND;
    this.bigBlind = config.BIG_BLIND;
    this.lastAggressorIndex = null;
    this.allInPlayers = [];
    this.sidePots = []; // Для разделения банков при all-in
    this.winners = []; // Победители текущей раздачи
  }

  // Начать новую игру (из Python: start_game)
  startGame() {
    console.log('🔄 Starting new game...');
    
    if (this.players.filter(p => p.chips > 0).length < 2) {
      console.log('❌ Not enough players with chips');
      this.stage = 'waiting';
      return false;
    }
    
    // Сброс состояния
    this.finished = false;
    this.roundFinished = false;
    this.actionsInCurrentStage = 0;
    this.allInPlayers = [];
    this.sidePots = [];
    this.winners = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    this.communityCards = [];
    
    // Создаем новую колоду и тасуем
    this.deck = new Deck();
    this.stage = 'preflop';
    
    // Раздаем карты игрокам
    this.players.forEach(player => {
      if (player.chips > 0) {
        player.hand = [this.deck.deal(), this.deck.deal()];
        player.folded = false;
        player.allIn = false;
        player.bet = 0;
        player.hasActed = false;
      } else {
        player.folded = true;
        player.hand = [];
      }
    });
    
    // Назначаем блайнды (логика из Python-бота)
    this.assignBlinds();
    
    console.log(`🎮 Game started. Stage: ${this.stage}, Pot: ${this.pot}`);
    return true;
  }

  // Назначение блайндов (из Python: post_blinds)
  assignBlinds() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length >= 2) {
      // Находим позиции для блайндов
      const sbIndex = this.findNextActivePlayer(this.dealerIndex, 1);
      const bbIndex = this.findNextActivePlayer(this.dealerIndex, 2);
      
      if (sbIndex !== -1) this.postBlind(sbIndex, this.smallBlind, 'small');
      if (bbIndex !== -1) this.postBlind(bbIndex, this.bigBlind, 'big');
      
      // Текущий игрок - после big blind
      this.currentPlayerIndex = this.findNextActivePlayer(bbIndex, 1);
      this.currentBet = this.bigBlind;
    }
  }

  // Поставить блайнд
  postBlind(playerIndex, amount, type) {
    const player = this.players[playerIndex];
    if (!player || player.folded) return;
    
    const actualAmount = Math.min(amount, player.chips);
    
    player.chips -= actualAmount;
    player.bet = actualAmount;
    this.pot += actualAmount;
    
    if (player.chips === 0) {
      player.allIn = true;
      this.allInPlayers.push(player.id);
      console.log(`⚠️ ${player.name} goes all-in with ${type} blind!`);
    }
    
    console.log(`🎲 ${player.name} posts ${type} blind: ${actualAmount}`);
  }

  // Найти следующего активного игрока
  findNextActivePlayer(startIndex, steps = 1) {
    let currentIndex = startIndex;
    let attempts = 0;
    
    while (attempts < this.players.length) {
      currentIndex = (currentIndex + 1) % this.players.length;
      const player = this.players[currentIndex];
      
      if (player && !player.folded) {
        steps--;
        if (steps === 0) return currentIndex;
      }
      
      attempts++;
    }
    
    return -1;
  }

  get currentPlayer() {
    if (this.currentPlayerIndex < 0 || this.currentPlayerIndex >= this.players.length) {
      return null;
    }
    return this.players[this.currentPlayerIndex];
  }

  // Обработка действия игрока (логика из Python: process_action)
  playerAction(playerId, action) {
    if (this.finished) {
      throw new Error('Game is already finished');
    }

    const player = this.currentPlayer;
    
    if (!player || player.id !== playerId) {
      throw new Error('Not your turn');
    }

    console.log(`👤 ${player.name} → ${JSON.stringify(action)}`);
    
    // Обработка разных типов действий
    if (action === 'fold') {
      this.handleFold(player);
    } else if (action === 'check') {
      this.handleCheck(player);
    } else if (action && action.type === 'bet') {
      this.handleBet(player, action.amount);
    } else if (action && action.type === 'call') {
      this.handleCall(player);
    } else if (action && action.type === 'raise') {
      this.handleRaise(player, action.amount);
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
    
    // Переход к следующему игроку
    this.moveToNextPlayer();
    
    // Проверка завершения раунда
    this.checkRoundCompletion();
    
    // Если игра завершена (один игрок или showdown)
    if (this.finished) {
      this.determineWinners();
    }
  }

  handleFold(player) {
    player.folded = true;
    console.log(`${player.name} folds`);
    
    // Проверяем, не остался ли один игрок
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.finished = true;
    }
  }

  handleCheck(player) {
    if (this.currentBet > player.bet) {
      throw new Error('Cannot check, must call or raise');
    }
    console.log(`${player.name} checks`);
    player.hasActed = true;
  }

  handleBet(player, amount) {
    if (this.currentBet > 0) {
      throw new Error('Cannot bet, must call or raise');
    }
    
    if (amount < this.bigBlind) {
      throw new Error(`Minimum bet is ${this.bigBlind}`);
    }
    
    if (amount > player.chips) {
      throw new Error('Not enough chips');
    }
    
    this.placeBet(player, amount);
    this.currentBet = amount;
    this.lastAggressorIndex = this.currentPlayerIndex;
    console.log(`${player.name} bets ${amount}`);
  }

  handleCall(player) {
    const amountToCall = this.currentBet - player.bet;
    
    if (amountToCall <= 0) {
      // Если нечего коллить, это чек
      this.handleCheck(player);
      return;
    }
    
    if (amountToCall >= player.chips) {
      // All-in
      this.placeBet(player, player.chips);
      player.allIn = true;
      this.allInPlayers.push(player.id);
      console.log(`${player.name} goes all-in for ${player.chips}`);
    } else {
      this.placeBet(player, amountToCall);
      console.log(`${player.name} calls ${amountToCall}`);
    }
    
    player.hasActed = true;
  }

  handleRaise(player, amount) {
    const minRaise = this.currentBet > 0 ? 
      Math.max(this.currentBet * 2, this.currentBet + this.bigBlind) : 
      this.bigBlind * 2;
    
    if (amount < minRaise) {
      throw new Error(`Minimum raise is ${minRaise}`);
    }
    
    const amountToCall = amount - player.bet;
    
    if (amountToCall >= player.chips) {
      // All-in raise
      this.placeBet(player, player.chips);
      player.allIn = true;
      this.allInPlayers.push(player.id);
      this.currentBet = Math.max(this.currentBet, player.bet);
      this.lastAggressorIndex = this.currentPlayerIndex;
      console.log(`${player.name} raises all-in for ${player.chips}`);
    } else {
      this.placeBet(player, amountToCall);
      this.currentBet = amount;
      this.lastAggressorIndex = this.currentPlayerIndex;
      console.log(`${player.name} raises to ${amount}`);
    }
    
    player.hasActed = true;
  }

  placeBet(player, amount) {
    const actualAmount = Math.min(amount, player.chips);
    
    player.chips -= actualAmount;
    player.bet += actualAmount;
    this.pot += actualAmount;
    
    if (player.chips === 0 && !player.allIn) {
      player.allIn = true;
      this.allInPlayers.push(player.id);
      console.log(`⚠️ ${player.name} is now all-in`);
    }
  }

  moveToNextPlayer() {
    const startIndex = this.currentPlayerIndex;
    let currentIndex = startIndex;
    
    do {
      currentIndex = (currentIndex + 1) % this.players.length;
      const player = this.players[currentIndex];
      
      if (player && !player.folded && !player.allIn) {
        this.currentPlayerIndex = currentIndex;
        console.log(`👤 Next player: ${player.name}`);
        return;
      }
    } while (currentIndex !== startIndex);
    
    // Все игроки all-in или folded
    this.currentPlayerIndex = -1;
  }

  checkRoundCompletion() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Если остался один игрок
    if (activePlayers.length === 1) {
      this.finished = true;
      return true;
    }
    
    // Проверяем, все ли активные игроки уравняли ставки
    const allBetsEqual = activePlayers.every(p => 
      p.allIn || p.bet === this.currentBet
    );
    
    if (!allBetsEqual) {
      return false;
    }
    
    // Проверяем, все ли игроки сделали действие
    const allActed = activePlayers.every(p => 
      p.allIn || p.hasActed || p.bet === this.currentBet
    );
    
    if (allActed) {
      this.finishBettingRound();
      return true;
    }
    
    return false;
  }

  finishBettingRound() {
    console.log(`🔁 ${this.stage} betting round finished`);
    this.roundFinished = true;
    
    // Сбрасываем флаги действий
    this.players.forEach(p => {
      p.hasActed = false;
      p.bet = 0;
    });
    
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    this.actionsInCurrentStage = 0;
    
    // Переход к следующей стадии
    this.advanceStage();
  }

  advanceStage() {
    this.roundFinished = false;
    
    switch (this.stage) {
      case 'preflop':
        this.stage = 'flop';
        this.dealCommunityCards(3);
        console.log('🟢 FLOP:', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        this.setFirstPlayerAfterDealer();
        break;
        
      case 'flop':
        this.stage = 'turn';
        this.dealCommunityCards(1);
        console.log('🟡 TURN:', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        this.setFirstPlayerAfterDealer();
        break;
        
      case 'turn':
        this.stage = 'river';
        this.dealCommunityCards(1);
        console.log('🔵 RIVER:', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        this.setFirstPlayerAfterDealer();
        break;
        
      case 'river':
        this.stage = 'showdown';
        console.log('🏁 SHOWDOWN - comparing hands...');
        this.finished = true;
        break;
    }
  }

  setFirstPlayerAfterDealer() {
    for (let i = 1; i <= this.players.length; i++) {
      const index = (this.dealerIndex + i) % this.players.length;
      const player = this.players[index];
      
      if (player && !player.folded && !player.allIn) {
        this.currentPlayerIndex = index;
        console.log(`🎯 First player after dealer: ${player.name}`);
        return;
      }
    }
    
    this.currentPlayerIndex = -1;
  }

  dealCommunityCards(count) {
    for (let i = 0; i < count; i++) {
      if (this.deck.remaining() > 0) {
        this.communityCards.push(this.deck.deal());
      }
    }
  }

  // Определение победителей (логика из Python: determine_winners)
  determineWinners() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      // Победитель по фолдам
      const winner = activePlayers[0];
      winner.chips += this.pot;
      this.winners = [winner];
      console.log(`🏆 Winner by fold: ${winner.name} wins ${this.pot}`);
      return;
    }
    
    // Шоудаун - сравниваем руки
    console.log('🏆 SHOWDOWN - comparing hands...');
    
    const playerHands = [];
    
    for (const player of activePlayers) {
      const allCards = [...player.hand, ...this.communityCards];
      const handRank = HandEvaluator.evaluate(allCards);
      
      console.log(`${player.name}: ${player.hand.map(c => `${c.rank}${c.suit}`).join(' ')} - ${handRank.name}`);
      
      playerHands.push({
        player: player,
        handRank: handRank
      });
    }
    
    // Сортируем по силе руки
    playerHands.sort((a, b) => 
      HandEvaluator.compareHands(b.handRank, a.handRank)
    );
    
    // Находим победителей (может быть несколько)
    const bestHand = playerHands[0].handRank;
    this.winners = playerHands
      .filter(p => HandEvaluator.compareHands(p.handRank, bestHand) === 0)
      .map(p => p.player);
    
    // Делим банк
    this.distributePot();
  }

  // Распределение банка (логика из Python: distribute_pot)
  distributePot() {
    if (this.winners.length === 0) return;
    
    const prize = Math.floor(this.pot / this.winners.length);
    const remainder = this.pot % this.winners.length;
    
    console.log(`💰 Pot: ${this.pot}, Winners: ${this.winners.length}, Prize: ${prize}`);
    
    for (let i = 0; i < this.winners.length; i++) {
      const winner = this.winners[i];
      const winAmount = prize + (i === 0 ? remainder : 0);
      winner.chips += winAmount;
      console.log(`🎯 ${winner.name} wins ${winAmount} chips`);
    }
    
    // Очищаем банк
    this.pot = 0;
  }

  // Получить публичное состояние игры
  getPublicState() {
    return {
      stage: this.stage,
      finished: this.finished,
      pot: this.pot,
      currentBet: this.currentBet,
      communityCards: this.communityCards,
      currentPlayerId: this.currentPlayer?.id || null,
      winners: this.winners.map(w => ({ id: w.id, name: w.name })),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        hasActed: p.hasActed
      }))
    };
  }

  // Получить приватное состояние игрока (его карты)
  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return player ? { hand: player.hand } : null;
  }

  // Выход игрока из игры
  playerLeave(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.folded = true;
      console.log(`🚪 ${player.name} left the game`);
      
      // Проверяем, не завершилась ли игра
      const activePlayers = this.players.filter(p => !p.folded);
      if (activePlayers.length === 1) {
        this.finished = true;
        this.determineWinners();
      }
    }
  }

  // Получить победителя (для обратной совместимости)
  getWinner() {
    return this.winners.length > 0 ? this.winners[0] : null;
  }
}

module.exports = { GameState };