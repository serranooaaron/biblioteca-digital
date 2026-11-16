// Utilidades compartidas por todas las páginas: avisos, llamadas a la API,
// menú móvil y cierre de sesión.

export const toast = (message, { type = 'ok' } = {}) => {
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  el.textContent = message;
  container.append(el);
  // Los errores quedan más tiempo: hay que alcanzar a leerlos.
  setTimeout(() => el.remove(), type === 'error' ? 7000 : 4000);
};

// Diálogo de confirmación propio (reemplaza a confirm() del navegador): se cierra con Escape,
// con "Cancelar" o tocando fuera, y devuelve true solo si se confirma.
export const confirmDialog = (message, { confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false } = {}) =>
  new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal confirm';
    dialog.setAttribute('aria-labelledby', 'confirm-message');

    const text = document.createElement('p');
    text.id = 'confirm-message';
    text.className = 'confirm__message';
    text.textContent = message;

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn--ghost';
    cancel.textContent = cancelLabel;

    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;
    accept.textContent = confirmLabel;

    const actions = document.createElement('div');
    actions.className = 'modal__foot';
    actions.append(cancel, accept);
    dialog.append(text, actions);
    document.body.append(dialog);

    const opener = document.activeElement;
    const close = (result) => {
      dialog.close();
      dialog.remove();
      opener?.focus?.();
      resolve(result);
    };
    cancel.addEventListener('click', () => close(false));
    accept.addEventListener('click', () => close(true));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(false); });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) close(false); });

    dialog.showModal();
    // En acciones que no se pueden deshacer el foco arranca en "Cancelar".
    (danger ? cancel : accept).focus();
  });

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
