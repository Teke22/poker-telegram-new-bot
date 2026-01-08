function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }

  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Функция сравнения карт (упрощенная - по старшей карте)
function getHandRank(hand, community) {
  const allCards = [...hand, ...community];
  
  const values = allCards.map(card => {
    const rank = card.rank;
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank);
  });
  
  return Math.max(...values);
}

class GameState {
  constructor(players) {
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips ?? 1000,
      hand: [],
      folded: false,
      allIn: false,
      bet: 0,
      hasActed: false // Отслеживаем, сделал ли игрок действие в текущем раунде
    }));

    this.deck = [];
    this.communityCards = [];
    this.stage = 'waiting';
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.finished = false;
    this.roundFinished = false;
    this.actionsInCurrentStage = 0; // Счетчик действий в текущей стадии

    // Ставки
    this.pot = 0;
    this.currentBet = 0;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.lastAggressorIndex = null;
  }

  startGame() {
    if (this.players.length < 2) return;
    
    this.deck = shuffle(createDeck());
    this.communityCards = [];
    this.stage = 'preflop';
    this.finished = false;
    this.roundFinished = false;
    this.actionsInCurrentStage = 0;

    this.pot = 0;
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    
    // Сброс состояния игроков
    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.folded = false;
      p.allIn = false;
      p.bet = 0;
      p.hasActed = false;
    });

    // Ставим блайнды
    const sbIndex = (this.dealerIndex + 1) % this.players.length;
    const bbIndex = (this.dealerIndex + 2) % this.players.length;
    
    this.postBlind(sbIndex, this.smallBlind, 'small');
    this.postBlind(bbIndex, this.bigBlind, 'big');
    
    // Текущий игрок после big blind
    this.currentPlayerIndex = (bbIndex + 1) % this.players.length;
    this.currentBet = this.bigBlind;
    
    console.log(`🎮 Game started. Dealer: ${this.players[this.dealerIndex].name}, SB: ${this.players[sbIndex].name}, BB: ${this.players[bbIndex].name}`);
  }

  postBlind(playerIndex, amount, type) {
    const player = this.players[playerIndex];
    const actualAmount = Math.min(amount, player.chips);
    
    player.chips -= actualAmount;
    player.bet = actualAmount;
    this.pot += actualAmount;
    
    if (player.chips === 0) {
      player.allIn = true;
    }
    
    console.log(`🎲 ${player.name} posts ${type} blind: ${actualAmount}`);
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextPlayer() {
    let attempts = 0;
    do {
      this.currentPlayerIndex = 
        (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;
      
      if (attempts > this.players.length) {
        // Все игроки фолднули или all-in
        this.currentPlayerIndex = -1;
        return;
      }
      
      const player = this.currentPlayer;
      if (!player.folded && !player.allIn) {
        break;
      }
    } while (true);
  }

  playerAction(playerId, action) {
    if (this.finished || this.roundFinished) return;

    const player = this.currentPlayer;

    if (!player || player.id !== playerId) {
      console.log('⛔ Not your turn');
      throw new Error('Сейчас не ваш ход');
    }

    console.log(`👤 ${player.name} →`, action);
    this.actionsInCurrentStage++;
    player.hasActed = true;

    // Обработка фолда
    if (action === 'fold') {
      player.folded = true;
      console.log(`${player.name} folded`);
      this.checkHandCompletion();
      this.nextPlayer();
      return;
    }

    // Обработка чека
    if (action === 'check') {
      // Нельзя чекать, если есть ставка, которую нужно уравнять
      if (this.currentBet > player.bet) {
        throw new Error('Нельзя чекнуть, есть ставка для колла');
      }
      
      console.log(`${player.name} checks`);
      this.nextPlayer();
      this.checkBettingRoundCompletion();
      return;
    }

    // Обработка ставки
    if (action?.type === 'bet') {
      // Нельзя беттить, если уже есть ставка
      if (this.currentBet > 0) {
        throw new Error('Уже есть ставка. Используйте колл или рейз');
      }

      const amount = action.amount;
      if (amount < this.bigBlind) {
        throw new Error(`Минимальная ставка: ${this.bigBlind}`);
      }
      
      if (amount > player.chips) {
        throw new Error('Недостаточно фишек');
      }

      this.makeBet(player, amount);
      this.currentBet = amount;
      this.lastAggressorIndex = this.currentPlayerIndex;
      console.log(`${player.name} bets ${amount}`);
      this.nextPlayer();
      this.checkBettingRoundCompletion();
      return;
    }

    // Обработка колла
    if (action?.type === 'call') {
      const toCall = this.currentBet - player.bet;
      
      if (toCall <= 0) {
        // Если нечего коллить, то это чек
        player.hasActed = true;
        this.nextPlayer();
        this.checkBettingRoundCompletion();
        return;
      }

      if (toCall > player.chips) {
        // All-in
        this.makeBet(player, player.chips);
        player.allIn = true;
        console.log(`${player.name} goes all-in for ${player.chips}`);
      } else {
        this.makeBet(player, toCall);
        console.log(`${player.name} calls ${toCall}`);
      }
      
      this.nextPlayer();
      this.checkBettingRoundCompletion();
      return;
    }

    // Обработка рейза
    if (action?.type === 'raise') {
      const minRaise = this.currentBet > 0 ? this.currentBet * 2 : this.bigBlind * 2;
      const raiseTo = action.amount;
      
      if (raiseTo < minRaise) {
        throw new Error(`Минимальный рейз: ${minRaise}`);
      }

      const toCall = raiseTo - player.bet;
      
      if (toCall > player.chips) {
        throw new Error('Недостаточно фишек');
      }

      this.makeBet(player, toCall);
      this.currentBet = raiseTo;
      this.lastAggressorIndex = this.currentPlayerIndex;
      console.log(`${player.name} raises to ${raiseTo}`);
      this.nextPlayer();
      this.checkBettingRoundCompletion();
      return;
    }
  }

  makeBet(player, amount) {
    const actualAmount = Math.min(amount, player.chips);
    
    player.chips -= actualAmount;
    player.bet += actualAmount;
    this.pot += actualAmount;
    
    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  checkBettingRoundCompletion() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Если остался один игрок, игра завершается
    if (activePlayers.length <= 1) {
      this.finishBettingRound();
      return true;
    }
    
    // Проверяем, все ли игроки уравняли ставки
    const allMatchedOrAllIn = activePlayers.every(p => 
      p.bet === this.currentBet || p.allIn
    );
    
    if (!allMatchedOrAllIn) {
      return false;
    }
    
    // Для реки: если все сделали по одному действию и все уравняли, завершаем
    if (this.stage === 'river') {
      const allHaveActed = activePlayers.every(p => p.hasActed || p.allIn);
      if (allHaveActed && allMatchedOrAllIn) {
        this.finishBettingRound();
        return true;
      }
    }
    
    // Проверяем, дошел ли ход до последнего агрессора
    if (this.lastAggressorIndex !== null) {
      let currentIndex = this.currentPlayerIndex;
      let foundAggressor = false;
      
      // Ищем, есть ли активный игрок между текущим и агрессором
      for (let i = 0; i < this.players.length; i++) {
        const player = this.players[currentIndex];
        
        if (!player.folded && !player.allIn && player.bet < this.currentBet) {
          // Нашли игрока, который еще не уравнял
          return false;
        }
        
        if (currentIndex === this.lastAggressorIndex) {
          foundAggressor = true;
          break;
        }
        
        currentIndex = (currentIndex + 1) % this.players.length;
      }
      
      if (foundAggressor) {
        this.finishBettingRound();
        return true;
      }
    } else {
      // Если не было ставок (только чеки)
      const allChecked = activePlayers.every(p => p.hasActed || p.allIn);
      if (allChecked) {
        this.finishBettingRound();
        return true;
      }
    }
    
    return false;
  }

  finishBettingRound() {
    console.log(`🔁 ${this.stage} betting round finished`);
    this.roundFinished = true;
    
    // Сбрасываем флаги действий игроков
    this.players.forEach(p => {
      p.hasActed = false;
    });
    
    this.actionsInCurrentStage = 0;
    
    setTimeout(() => {
      this.advanceStage();
    }, 1000);
  }

  advanceStage() {
    this.roundFinished = false;
    
    switch (this.stage) {
      case 'preflop':
        this.stage = 'flop';
        this.dealCommunityCards(3);
        console.log('🟢 FLOP:', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        this.resetForNewStage();
        break;
        
      case 'flop':
        this.stage = 'turn';
        this.dealCommunityCards(1);
        console.log('🟡 TURN:', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        this.resetForNewStage();
        break;
        
      case 'turn':
        this.stage = 'river';
        this.dealCommunityCards(1);
        console.log('🔵 RIVER:', this.communityCards.map(c => `${c.rank}${c.suit}`).join(' '));
        this.resetForNewStage();
        break;
        
      case 'river':
        console.log('🏁 SHOWDOWN');
        this.finishHand();
        break;
    }
  }

  resetForNewStage() {
    // Сбрасываем ставки для нового раунда
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    this.players.forEach(p => {
      p.bet = 0;
    });
    
    // Устанавливаем первого активного игрока после дилера
    this.setFirstPlayerAfterDealer();
  }

  setFirstPlayerAfterDealer() {
    // Находим первого активного игрока после дилера
    for (let i = 1; i <= this.players.length; i++) {
      const index = (this.dealerIndex + i) % this.players.length;
      const player = this.players[index];
      
      if (!player.folded && !player.allIn) {
        this.currentPlayerIndex = index;
        break;
      }
    }
    
    // Если не нашли активного игрока
    if (this.currentPlayerIndex === -1 || 
        this.players[this.currentPlayerIndex].folded || 
        this.players[this.currentPlayerIndex].allIn) {
      this.finishHand();
    }
  }

  dealCommunityCards(count) {
    for (let i = 0; i < count; i++) {
      this.communityCards.push(this.deck.pop());
    }
  }

  checkHandCompletion() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      // Остался один игрок - он победитель
      console.log(`👑 Only one player left: ${activePlayers[0].name}`);
      this.finishHand();
    } else if (activePlayers.length === 0) {
      // Все фолднули (маловероятно)
      console.log('🤷 All players folded');
      this.finishHand();
    }
  }

  finishHand() {
    this.finished = true;
    
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      // Победитель по фолдам
      const winner = activePlayers[0];
      winner.chips += this.pot;
      console.log(`🏆 Winner by fold: ${winner.name} wins ${this.pot}`);
    } else {
      // Шоудаун
      console.log('🏆 SHOWDOWN! Comparing hands...');
      this.determineShowdownWinner();
    }
    
    // Перемещаем дилера для следующей раздачи
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    console.log(`♻️ Next dealer: ${this.players[this.dealerIndex].name}`);
  }

  determineShowdownWinner() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 0) {
      console.log('🤷 No active players in showdown');
      return;
    }
    
    // Упрощенное определение победителя (по старшей карте)
    let bestRank = -1;
    let winners = [];
    
    console.log('🃏 Showdown hands:');
    for (const player of activePlayers) {
      const rank = getHandRank(player.hand, this.communityCards);
      console.log(`${player.name}: ${player.hand.map(c => `${c.rank}${c.suit}`).join(' ')} (rank: ${rank})`);
      
      if (rank > bestRank) {
        bestRank = rank;
        winners = [player];
      } else if (rank === bestRank) {
        winners.push(player);
      }
    }
    
    // Делим банк
    const prize = Math.floor(this.pot / winners.length);
    const remainder = this.pot % winners.length;
    
    for (const winner of winners) {
      winner.chips += prize;
      if (remainder > 0 && winner === winners[0]) {
        winner.chips += remainder; // Остаток первому победителю
      }
      console.log(`🎯 ${winner.name} wins ${prize + (remainder > 0 && winner === winners[0] ? remainder : 0)}`);
    }
    
    console.log(`💰 Pot distributed. Winners: ${winners.map(w => w.name).join(', ')}`);
  }

  // Метод для выхода игрока из игры
  playerLeave(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.folded = true;
      console.log(`🚪 ${player.name} left the table`);
      this.checkHandCompletion();
      
      // Если игра еще не началась, просто удаляем игрока
      if (this.stage === 'waiting') {
        this.players = this.players.filter(p => p.id !== playerId);
      }
    }
  }

  getPublicState() {
    return {
      stage: this.stage,
      finished: this.finished,
      pot: this.pot,
      currentBet: this.currentBet,
      communityCards: this.communityCards,
      currentPlayerId: this.currentPlayer?.id || null,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        folded: p.folded,
        chips: p.chips,
        bet: p.bet,
        allIn: p.allIn
      }))
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return player ? { hand: player.hand } : null;
  }
}

module.exports = { GameState };