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

// 🃏 Функция сравнения карт (упрощенно)
function getHandRank(hand, community) {
  // Временная реализация - сравнение по старшей карте
  const allCards = [...hand, ...community];
  
  // Присваиваем числовые значения картам
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
      bet: 0
    }));

    this.deck = [];
    this.communityCards = [];
    this.stage = 'waiting';
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.finished = false;
    this.roundFinished = false;

    // 🔹 Ставки
    this.pot = 0;
    this.currentBet = 0;
    this.sidePots = [];
    this.lastAggressorIndex = null;
    this.smallBlind = 10;
    this.bigBlind = 20;
  }

  startGame() {
    if (this.players.length < 2) return;
    
    this.deck = shuffle(createDeck());
    this.communityCards = [];
    this.stage = 'preflop';
    this.finished = false;
    this.roundFinished = false;

    this.pot = 0;
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    
    // Сброс состояния игроков
    this.players.forEach(p => {
      p.hand = [this.deck.pop(), this.deck.pop()];
      p.folded = false;
      p.allIn = false;
      p.bet = 0;
    });

    // Ставим блайнды
    const sbIndex = (this.dealerIndex + 1) % this.players.length;
    const bbIndex = (this.dealerIndex + 2) % this.players.length;
    
    this.postBlind(sbIndex, this.smallBlind, 'small');
    this.postBlind(bbIndex, this.bigBlind, 'big');
    
    // Текущий игрок после big blind
    this.currentPlayerIndex = (bbIndex + 1) % this.players.length;
    this.currentBet = this.bigBlind;
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

    if (player.id !== playerId) {
      console.log('⛔ Not your turn');
      return;
    }

    console.log(`👤 ${player.name} →`, action);

    if (action === 'fold') {
      player.folded = true;
      this.checkHandCompletion();
      return;
    }

    if (action === 'check') {
      if (this.currentBet > player.bet) {
        console.log('⛔ Cannot check, bet exists');
        return;
      }
      this.nextPlayer();
      this.checkBettingRoundCompletion();
    }

    if (action?.type === 'bet') {
      if (this.currentBet > 0) {
        console.log('⛔ Cannot bet, bet already exists');
        return;
      }

      const amount = action.amount;
      if (amount < this.bigBlind || amount > player.chips) {
        console.log('⛔ Invalid bet amount');
        return;
      }

      this.makeBet(player, amount);
      this.lastAggressorIndex = this.currentPlayerIndex;
      this.nextPlayer();
      this.checkBettingRoundCompletion();
    }

    if (action?.type === 'call') {
      const toCall = this.currentBet - player.bet;
      
      if (toCall <= 0) {
        console.log('⛔ Nothing to call');
        return;
      }

      if (toCall >= player.chips) {
        // All-in
        this.makeBet(player, player.chips);
        player.allIn = true;
      } else {
        this.makeBet(player, toCall);
      }
      
      this.nextPlayer();
      this.checkBettingRoundCompletion();
    }

    if (action?.type === 'raise') {
      const minRaise = this.currentBet * 2;
      const raiseTo = action.amount;
      
      if (raiseTo < minRaise) {
        console.log('⛔ Raise must be at least double current bet');
        return;
      }

      const toCall = raiseTo - player.bet;
      
      if (toCall > player.chips) {
        console.log('⛔ Not enough chips');
        return;
      }

      this.makeBet(player, toCall);
      this.currentBet = raiseTo;
      this.lastAggressorIndex = this.currentPlayerIndex;
      this.nextPlayer();
      this.checkBettingRoundCompletion();
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
    
    // Обновляем максимальную ставку
    if (player.bet > this.currentBet) {
      this.currentBet = player.bet;
    }
  }

  checkBettingRoundCompletion() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Все ли уравняли ставки?
    const allMatched = activePlayers.every(p => 
      p.bet === this.currentBet || p.allIn
    );
    
    if (!allMatched) return false;
    
    // Проверяем, завершился ли раунд
    // Раунд завершен, если последний повышавший сделал ход
    if (this.lastAggressorIndex === null) {
      this.finishBettingRound();
      return true;
    }
    
    // Находим следующего активного игрока после агрессора
    let nextPlayerIndex = (this.lastAggressorIndex + 1) % this.players.length;
    let attempts = 0;
    
    while (attempts < this.players.length) {
      const player = this.players[nextPlayerIndex];
      
      if (!player.folded && !player.allIn && player.bet === this.currentBet) {
        // Нашли игрока, который уже уравнял и находится после агрессора
        // значит раунд завершен
        this.finishBettingRound();
        return true;
      }
      
      nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
      attempts++;
    }
    
    return false;
  }

  finishBettingRound() {
    console.log('🔁 Betting round finished');
    this.roundFinished = true;
    
    // Сброс ставок для следующего раунда
    this.players.forEach(p => {
      p.bet = 0;
    });
    
    this.currentBet = 0;
    this.lastAggressorIndex = null;
    
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
        console.log('🟢 FLOP', this.communityCards);
        this.setFirstPlayerAfterDealer();
        break;
        
      case 'flop':
        this.stage = 'turn';
        this.dealCommunityCards(1);
        console.log('🟡 TURN', this.communityCards);
        this.setFirstPlayerAfterDealer();
        break;
        
      case 'turn':
        this.stage = 'river';
        this.dealCommunityCards(1);
        console.log('🔵 RIVER', this.communityCards);
        this.setFirstPlayerAfterDealer();
        break;
        
      case 'river':
        console.log('🏁 SHOWDOWN');
        this.finishHand();
        break;
    }
  }

  setFirstPlayerAfterDealer() {
    // Находим первого активного игрока после дилера
    for (let i = 1; i <= this.players.length; i++) {
      const index = (this.dealerIndex + i) % this.players.length;
      const player = this.players[index];
      
      if (!player.folded && !player.allIn) {
        this.currentPlayerIndex = index;
        this.lastAggressorIndex = null;
        break;
      }
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
      this.finishHand();
    } else if (activePlayers.length === 0) {
      // Все фолднули (маловероятно, но на всякий случай)
      this.finishHand();
    }
  }

  finishHand() {
    this.finished = true;
    
    // Определяем победителя
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      // Победитель по фолдам
      const winner = activePlayers[0];
      winner.chips += this.pot;
      console.log(`🏆 Winner by fold: ${winner.name}`);
      
      // Перемещаем дилера
      this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    } else {
      // Шоудаун - сравниваем комбинации
      this.determineShowdownWinner();
    }
  }

  determineShowdownWinner() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 0) {
      console.log('🤷 No active players');
      return;
    }
    
    // Упрощенное определение победителя (по старшей карте)
    let bestRank = -1;
    let winners = [];
    
    for (const player of activePlayers) {
      const rank = getHandRank(player.hand, this.communityCards);
      
      if (rank > bestRank) {
        bestRank = rank;
        winners = [player];
      } else if (rank === bestRank) {
        winners.push(player);
      }
    }
    
    // Делим банк
    const prize = Math.floor(this.pot / winners.length);
    
    for (const winner of winners) {
      winner.chips += prize;
      console.log(`🏆 Showdown winner: ${winner.name} (rank: ${bestRank})`);
    }
    
    // Перемещаем дилера
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
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