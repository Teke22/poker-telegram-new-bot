// Утилиты для игры

function getGameActionsHTML(toCall, canCheck, canCall, canBet, canRaise, meInGame, gameState) {
  let actionsHTML = '';
  
  if (toCall > 0) {
    actionsHTML += `
      <div style="background:rgba(231, 76, 60, 0.2); padding:10px; border-radius:8px; margin-bottom:15px;">
        <p style="margin:0; font-size:16px;">
          Нужно поставить: <strong style="color:#e74c3c; font-size:18px;">${toCall}</strong> чтобы коллировать
        </p>
        <p style="margin:5px 0 0 0; font-size:14px; color:#bdc3c7;">
          Текущая ставка: ${gameState.currentBet}, ваша ставка: ${meInGame.bet}
        </p>
      </div>
    `;
  }
  
  actionsHTML += `
    <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
      <button onclick="fold()" class="btn-fold" style="flex:1; min-width:120px;">
        ❌ ФОЛД
      </button>
      
      ${canCheck ? `
        <button onclick="check()" class="btn-check" style="flex:1; min-width:120px;">
          ✓ ЧЕК
        </button>
      ` : ''}
      
      ${canCall ? `
        <button onclick="call()" class="btn-call" style="flex:1; min-width:120px;">
          📞 КОЛЛ (${toCall})
        </button>
      ` : ''}
      
      ${canBet ? `
        <button onclick="showBetDialog('bet')" class="btn-bet" style="flex:1; min-width:120px;">
          💰 БЕТ
        </button>
      ` : ''}
      
      ${canRaise ? `
        <button onclick="showBetDialog('raise')" class="btn-raise" style="flex:1; min-width:120px;">
          📈 РЕЙЗ
        </button>
      ` : ''}
      
      ${meInGame.chips > 0 ? `
        <button onclick="allIn()" class="btn-allin" style="flex:1; min-width:120px;">
          ⚡ ALL-IN (${meInGame.chips})
        </button>
      ` : ''}
    </div>
  `;
  
  return actionsHTML;
}