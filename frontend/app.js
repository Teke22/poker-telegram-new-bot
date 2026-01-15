socket.on('hand_finished', ({ winner, reason }) => {
  if (winner) {
    alert(`🏆 Победитель: ${winner.name}`);
  } else {
    alert('Рука завершена');
  }
});
