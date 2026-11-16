import { api, reloadWith, toast } from './app.js';

// Botones "Pedir", "Reservar" y "Salir de la lista" de cualquier página (catálogo, libro, mis préstamos).
// Cada bloque [data-book-actions] lleva el id y el título del libro.
const ACTIONS = [
  {
    selector: '[data-borrow]',
    busy: 'Pidiendo…',
    run: (id) => api(`/api/loans/${id}`, { method: 'POST' }),
    done: (title) => `Pediste “${title}”. ¡Buena lectura!`,
  },
  {
    selector: '[data-reserve]',
    busy: 'Reservando…',
    run: (id) => api(`/api/reservations/${id}`, { method: 'POST' }),
    done: (title) => `Reservaste “${title}”. Te avisamos acá cuando esté listo.`,
  },
  {
    selector: '[data-cancel-reservation]',
    busy: 'Cancelando…',
    confirm: (title) => `¿Salir de la lista de espera de “${title}”? Perderás tu lugar.`,
    run: (id) => api(`/api/reservations/${id}`, { method: 'DELETE' }),
    done: (title) => `Saliste de la lista de espera de “${title}”.`,
  },
];

document.addEventListener('click', async (event) => {
  for (const action of ACTIONS) {
    const button = event.target.closest(action.selector);
    if (!button) continue;
    const { bookId, bookTitle } = button.closest('[data-book-actions]').dataset;
    if (action.confirm && !confirm(action.confirm(bookTitle))) return;

    const label = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = action.busy;
    try {
      await action.run(bookId);
      reloadWith(action.done(bookTitle));
    } catch (error) {
      toast(error.message, { type: 'error' });
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = label;
    }
    return;
  }
});
