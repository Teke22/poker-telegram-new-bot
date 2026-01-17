export function showLobby(state) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <h1 style="text-align:center;">🎴 POKER ROYALE</h1>
    <button onclick="window.createRoom()">Создать комнату</button>
  `;
}
