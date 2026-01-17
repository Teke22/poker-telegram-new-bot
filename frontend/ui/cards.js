export function renderCard(card, winning = false) {
  if (!card) return '';
  const suitMap = { s:'♠', h:'♥', d:'♦', c:'♣' };
  const isRed = card.suit === 'h' || card.suit === 'd';

  return `
    <div class="card ${isRed ? 'card-red' : 'card-black'} ${winning ? 'winning-card' : ''}">
      <div class="card-rank">${card.rank}</div>
      <div class="card-center">${suitMap[card.suit]}</div>
      <div class="card-suit">${suitMap[card.suit]}</div>
    </div>
  `;
}
