// Utilidades compartidas por todas las páginas: avisos, llamadas a la API,
// menú móvil y cierre de sesión.

export const toast = (message, { type = 'ok' } = {}) => {
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  el.textContent = message;
  container.append(el);
  setTimeout(() => el.remove(), 3500);
};

// fetch a la API; acepta JSON o FormData. Lanza un Error con el mensaje del servidor si falla.
export const api = async (url, { method = 'GET', body } = {}) => {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Ocurrió un error, intenta de nuevo');
    error.status = res.status;
    throw error;
  }
  return data;
};

// Muestra un aviso después de recargar la página (si el navegador permite sessionStorage).
const FLASH_KEY = 'biblioteca-flash';
export const reloadWith = (message) => {
  try { sessionStorage.setItem(FLASH_KEY, message); } catch {}
  window.location.reload();
};
try {
  const flash = sessionStorage.getItem(FLASH_KEY);
  if (flash) {
    sessionStorage.removeItem(FLASH_KEY);
    toast(flash);
  }
} catch {}

document.querySelector('[data-logout]')?.addEventListener('click', async () => {
  await api('/api/sessions/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/';
});

const navToggle = document.querySelector('[data-nav-toggle]');
navToggle?.addEventListener('click', () => {
  const nav = document.getElementById('main-nav');
  const open = nav.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(open));
});

document.addEventListener('click', (event) => {
  const menu = document.querySelector('.user-menu[open]');
  if (menu && !menu.contains(event.target)) menu.removeAttribute('open');
});
