import { api, confirmDialog, reloadWith, toast } from './app.js';
import './bookActions.js';

const bookId = document.querySelector('[data-book]')?.dataset.book;
const form = document.querySelector('[data-review-form]');
const errorBox = document.querySelector('[data-review-error]');

// Deshabilita el botón y muestra qué está pasando; devuelve la función que lo restaura.
const busy = (button, label) => {
  const original = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = label;
  return () => {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = original;
  };
};

// Contador de caracteres del comentario.
const comment = form?.querySelector('#comment');
const counter = form?.querySelector('[data-counter]');
const updateCounter = () => {
  if (!comment || !counter) return;
  counter.textContent = `${comment.value.length} de ${comment.maxLength} caracteres`;
};
comment?.addEventListener('input', updateCounter);
updateCounter();

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.textContent = '';
  const rating = form.querySelector('input[name="rating"]:checked')?.value;
  if (!rating) {
    errorBox.textContent = 'Elige de 1 a 5 estrellas.';
    form.querySelector('input[name="rating"]').focus();
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  const done = busy(button, 'Guardando…');
  try {
    await api(`/api/books/${bookId}/reviews`, { method: 'PUT', body: { rating: Number(rating), comment: comment.value } });
    reloadWith('¡Gracias! Tu reseña quedó publicada.');
  } catch (error) {
    errorBox.textContent = error.message;
    done();
  }
});

// Borrar la propia reseña o, para administradores, quitar la de otro lector.
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete-review]');
  if (!button) return;
  if (!(await confirmDialog('¿Borrar esta reseña? No se puede deshacer.', { confirmLabel: 'Borrar', danger: true }))) return;
  const done = busy(button, 'Borrando…');
  try {
    await api(`/api/books/${bookId}/reviews/${button.dataset.deleteReview}`, { method: 'DELETE' });
    reloadWith('Reseña borrada.');
  } catch (error) {
    toast(error.message, { type: 'error' });
    done();
  }
});
