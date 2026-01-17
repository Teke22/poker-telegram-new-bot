export function stageName(stage) {
  return {
    preflop: 'Префлоп',
    flop: 'Флоп',
    turn: 'Тёрн',
    river: 'Ривер',
    showdown: 'Шоудаун'
  }[stage] || stage;
}

export function playerName(p, isMe = false) {
  if (!p?.name) return 'Игрок...';
  return isMe ? `${p.name} 👤` : p.name;
}
