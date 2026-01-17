export function initUser() {
  const tg = window.Telegram?.WebApp;

  if (tg && tg.initDataUnsafe?.user) {
    const u = tg.initDataUnsafe.user;
    return {
      id: String(u.id),
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      name: '',
      chips: 1000
    };
  }

  const randomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    id: 'debug_' + randomId,
    name: '',
    chips: 1000
  };
}
