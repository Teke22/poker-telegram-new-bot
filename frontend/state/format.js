export function getStageName(stage) {
  return {
    preflop: 'Префлоп',
    flop: 'Флоп',
    turn: 'Тёрн',
    river: 'Ривер',
    showdown: 'Шоудаун'
  }[stage] || stage;
}

export function getPlayerName(player, isMe = false) {
  if (!player?.name) return 'Игрок...';
  return isMe ? `${player.name} 👤` : player.name;
}
