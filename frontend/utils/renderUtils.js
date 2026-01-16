// Функции для отображения элементов

function getPlayerDisplayName(player, isMe = false) {
  if (isMe) return `${player.name} 👤`;
  
  if (!player.name) return `Игрок...`;
  
  if (player.name.startsWith('@')) return player.name;
  
  return player.name.length > 15 ? player.name.substring(0, 15) + '...' : player.name;
}

function renderCard(card, isWinning = false) {
  if (!card) return '';
  
  const rank = card.rank;
  const suit = card.suit.toLowerCase();
  const isRed = suit === 'h' || suit === 'd';
  const suitSymbol = {
    's': '♠',
    'h': '♥',
    'd': '♦',
    'c': '♣'
  }[suit] || suit;
  
  let rankSymbol = rank;
  if (rank === 'J') rankSymbol = 'В';
  else if (rank === 'Q') rankSymbol = 'Д';
  else if (rank === 'K') rankSymbol = 'К';
  else if (rank === 'A') rankSymbol = 'Т';
  else if (rank === 'T') rankSymbol = '10';
  
  return `
    <div class="card ${isRed ? 'card-red' : 'card-black'} ${isWinning ? 'winning-card' : ''}">
      <div class="card-rank">${rankSymbol}</div>
      <div class="card-center">${suitSymbol}</div>
      <div class="card-suit">${suitSymbol}</div>
    </div>
  `;
}

function getStageName(stage) {
  const stages = {
    'preflop': 'Префлоп',
    'flop': 'Флоп',
    'turn': 'Тёрн',
    'river': 'Ривер',
    'showdown': 'Шоудаун'
  };
  return stages[stage] || stage;
}