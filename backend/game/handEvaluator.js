class HandEvaluator {
  // Основной метод оценки руки
  static evaluate(cards) {
    if (!cards || cards.length < 5) {
      return { rank: 0, name: 'Invalid hand', high: 0 };
    }

    // Конвертируем карты в числовой формат
    const numericCards = cards.map(card => this.convertCardToNumeric(card));
    
    // Сортируем по значению (от высокого к низкому)
    numericCards.sort((a, b) => b.value - a.value);
    
    // Получаем все возможные комбинации
    const handRank = this.getBestHandRank(numericCards);
    
    return handRank;
  }

  // Конвертация карты в числовой формат
  static convertCardToNumeric(card) {
    let value;
    const rank = card.rank.toUpperCase();
    
    if (rank === 'A') value = 14;
    else if (rank === 'K') value = 13;
    else if (rank === 'Q') value = 12;
    else if (rank === 'J') value = 11;
    else value = parseInt(rank);
    
    // Для стрита Ace может быть 1
    const suit = card.suit;
    const suitChar = suit === '♠' ? 'spades' :
                    suit === '♥' ? 'hearts' :
                    suit === '♦' ? 'diamonds' : 'clubs';
    
    return {
      original: card,
      value: value,
      suit: suitChar,
      rank: rank
    };
  }

  // Получение лучшей комбинации из карт
  static getBestHandRank(cards) {
    // Проверяем все комбинации от самой сильной к слабой
    const royalFlush = this.checkRoyalFlush(cards);
    if (royalFlush) return { rank: 10, name: 'Royal Flush', high: 14, cards: royalFlush };

    const straightFlush = this.checkStraightFlush(cards);
    if (straightFlush) return { rank: 9, name: 'Straight Flush', high: straightFlush[0].value, cards: straightFlush };

    const fourOfAKind = this.checkFourOfAKind(cards);
    if (fourOfAKind) return { rank: 8, name: 'Four of a Kind', high: fourOfAKind.value, cards: fourOfAKind.cards };

    const fullHouse = this.checkFullHouse(cards);
    if (fullHouse) return { rank: 7, name: 'Full House', high: fullHouse.threeOfAKind, cards: fullHouse.cards };

    const flush = this.checkFlush(cards);
    if (flush) return { rank: 6, name: 'Flush', high: flush[0].value, cards: flush };

    const straight = this.checkStraight(cards);
    if (straight) return { rank: 5, name: 'Straight', high: straight[0].value, cards: straight };

    const threeOfAKind = this.checkThreeOfAKind(cards);
    if (threeOfAKind) return { rank: 4, name: 'Three of a Kind', high: threeOfAKind.value, cards: threeOfAKind.cards };

    const twoPair = this.checkTwoPair(cards);
    if (twoPair) return { rank: 3, name: 'Two Pair', high: twoPair.highPair, cards: twoPair.cards };

    const pair = this.checkPair(cards);
    if (pair) return { rank: 2, name: 'Pair', high: pair.value, cards: pair.cards };

    // High card
    return { rank: 1, name: 'High Card', high: cards[0].value, cards: cards.slice(0, 5) };
  }

  // Проверка на Royal Flush
  static checkRoyalFlush(cards) {
    const straightFlush = this.checkStraightFlush(cards);
    if (straightFlush && straightFlush[0].value === 14) {
      return straightFlush;
    }
    return null;
  }

  // Проверка на Straight Flush
  static checkStraightFlush(cards) {
    // Группируем карты по мастям
    const suits = {};
    cards.forEach(card => {
      if (!suits[card.suit]) suits[card.suit] = [];
      suits[card.suit].push(card);
    });

    // Проверяем каждую масть на стрит
    for (const suit in suits) {
      if (suits[suit].length >= 5) {
        const straight = this.checkStraight(suits[suit]);
        if (straight) return straight;
      }
    }
    return null;
  }

  // Проверка на Four of a Kind
  static checkFourOfAKind(cards) {
    const valueCounts = this.countValues(cards);
    
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count >= 4) {
        const fourCards = cards.filter(c => c.value === parseInt(value));
        const kicker = cards.find(c => c.value !== parseInt(value));
        return {
          value: parseInt(value),
          cards: [...fourCards.slice(0, 4), kicker].filter(c => c)
        };
      }
    }
    return null;
  }

  // Проверка на Full House
  static checkFullHouse(cards) {
    const valueCounts = this.countValues(cards);
    let threeOfAKindValue = null;
    let pairValue = null;

    // Ищем сет и пару
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count >= 3 && !threeOfAKindValue) {
        threeOfAKindValue = parseInt(value);
      } else if (count >= 2) {
        pairValue = Math.max(pairValue || 0, parseInt(value));
      }
    }

    // Ищем вторую пару если сет уже найден
    if (threeOfAKindValue) {
      for (const [value, count] of Object.entries(valueCounts)) {
        const numValue = parseInt(value);
        if (count >= 2 && numValue !== threeOfAKindValue) {
          pairValue = Math.max(pairValue || 0, numValue);
        }
      }
    }

    if (threeOfAKindValue && pairValue) {
      const threeCards = cards.filter(c => c.value === threeOfAKindValue);
      const pairCards = cards.filter(c => c.value === pairValue);
      return {
        threeOfAKind: threeOfAKindValue,
        pair: pairValue,
        cards: [...threeCards.slice(0, 3), ...pairCards.slice(0, 2)]
      };
    }
    return null;
  }

  // Проверка на Flush
  static checkFlush(cards) {
    const suitCounts = {};
    cards.forEach(card => {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });

    for (const [suit, count] of Object.entries(suitCounts)) {
      if (count >= 5) {
        const flushCards = cards
          .filter(c => c.suit === suit)
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        return flushCards;
      }
    }
    return null;
  }

  // Проверка на Straight
  static checkStraight(cards) {
    // Убираем дубликаты по значению
    const uniqueCards = [];
    const seenValues = new Set();
    
    for (const card of cards) {
      if (!seenValues.has(card.value)) {
        seenValues.add(card.value);
        uniqueCards.push(card);
      }
    }

    // Сортируем по убыванию
    uniqueCards.sort((a, b) => b.value - a.value);

    // Проверяем стрит из 5 карт
    for (let i = 0; i <= uniqueCards.length - 5; i++) {
      if (uniqueCards[i].value - uniqueCards[i + 4].value === 4) {
        return uniqueCards.slice(i, i + 5);
      }
    }

    // Проверяем стрит с Ace как 1 (A-2-3-4-5)
    const hasAce = uniqueCards.some(c => c.value === 14);
    const hasTwo = uniqueCards.some(c => c.value === 2);
    const hasThree = uniqueCards.some(c => c.value === 3);
    const hasFour = uniqueCards.some(c => c.value === 4);
    const hasFive = uniqueCards.some(c => c.value === 5);

    if (hasAce && hasTwo && hasThree && hasFour && hasFive) {
      const straightCards = uniqueCards.filter(c => 
        c.value === 14 || c.value === 5 || c.value === 4 || c.value === 3 || c.value === 2
      );
      // Ace становится 1 для этого стрита
      const aceCard = straightCards.find(c => c.value === 14);
      if (aceCard) {
        aceCard.value = 1;
        aceCard.straightAceLow = true;
      }
      straightCards.sort((a, b) => b.value - a.value);
      return straightCards.slice(0, 5);
    }

    return null;
  }

  // Проверка на Three of a Kind
  static checkThreeOfAKind(cards) {
    const valueCounts = this.countValues(cards);
    
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count >= 3) {
        const threeCards = cards.filter(c => c.value === parseInt(value));
        const kickers = cards
          .filter(c => c.value !== parseInt(value))
          .sort((a, b) => b.value - a.value)
          .slice(0, 2);
        return {
          value: parseInt(value),
          cards: [...threeCards.slice(0, 3), ...kickers]
        };
      }
    }
    return null;
  }

  // Проверка на Two Pair
  static checkTwoPair(cards) {
    const valueCounts = this.countValues(cards);
    const pairs = [];
    
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count >= 2) {
        pairs.push(parseInt(value));
      }
    }
    
    if (pairs.length >= 2) {
      // Сортируем пары по значению
      pairs.sort((a, b) => b - a);
      const highPair = pairs[0];
      const lowPair = pairs[1];
      
      const highPairCards = cards.filter(c => c.value === highPair).slice(0, 2);
      const lowPairCards = cards.filter(c => c.value === lowPair).slice(0, 2);
      const kicker = cards
        .filter(c => c.value !== highPair && c.value !== lowPair)
        .sort((a, b) => b.value - a.value)[0];
      
      return {
        highPair: highPair,
        lowPair: lowPair,
        cards: [...highPairCards, ...lowPairCards, kicker].filter(c => c)
      };
    }
    return null;
  }

  // Проверка на Pair
  static checkPair(cards) {
    const valueCounts = this.countValues(cards);
    
    for (const [value, count] of Object.entries(valueCounts)) {
      if (count >= 2) {
        const pairCards = cards.filter(c => c.value === parseInt(value)).slice(0, 2);
        const kickers = cards
          .filter(c => c.value !== parseInt(value))
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);
        return {
          value: parseInt(value),
          cards: [...pairCards, ...kickers]
        };
      }
    }
    return null;
  }

  // Подсчет количества карт каждого значения
  static countValues(cards) {
    const counts = {};
    cards.forEach(card => {
      counts[card.value] = (counts[card.value] || 0) + 1;
    });
    return counts;
  }

  // Сравнение двух рук для определения победителя
  static compareHands(hand1, hand2) {
    // Сначала сравниваем по рангу комбинации
    if (hand1.rank !== hand2.rank) {
      return hand1.rank > hand2.rank ? 1 : -1;
    }
    
    // Если одинаковый ранг, сравниваем по старшей карте комбинации
    if (hand1.high !== hand2.high) {
      return hand1.high > hand2.high ? 1 : -1;
    }
    
    // Если все еще равны, сравниваем кикеры
    const kickers1 = hand1.cards.map(c => c.value).sort((a, b) => b - a);
    const kickers2 = hand2.cards.map(c => c.value).sort((a, b) => b - a);
    
    for (let i = 0; i < Math.min(kickers1.length, kickers2.length); i++) {
      if (kickers1[i] !== kickers2[i]) {
        return kickers1[i] > kickers2[i] ? 1 : -1;
      }
    }
    
    return 0; // Полное равенство
  }
}

module.exports = HandEvaluator;