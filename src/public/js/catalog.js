import { api, toast } from './app.js';

// Los filtros de disponibilidad y orden se aplican al cambiar, sin tocar "Buscar".
document.querySelectorAll('[data-autosubmit]').forEach((el) =>
  el.addEventListener('change', () => el.form.requestSubmit())
);

// "Pedir": registra el préstamo y actualiza la tarjeta sin recargar la página.
document.querySelector('.book-grid')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-borrow]');
  if (!button) return;
  const card = button.closest('[data-book]');
  button.disabled = true;
  try {
    await api(`/api/loans/${card.dataset.book}`, { method: 'POST' });
    card.querySelector('[data-book-actions]').innerHTML =
      '<span class="badge badge--ok">Lo tienes tú</span><a class="btn btn--sm btn--ghost" href="/mis-prestamos">Ver</a>';
    toast(`Pediste “${card.querySelector('.book-card__title').textContent}”. ¡Buena lectura!`);
  } catch (error) {
    toast(error.message, { type: 'error' });
    button.disabled = false;
  }
});
