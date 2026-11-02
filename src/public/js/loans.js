import { api, reloadWith, toast } from './app.js';

// "Devolver": registra la devolución y recarga para pasar el libro al historial.
document.querySelector('[data-active-list]')?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-return]');
  if (!button) return;
  const loan = button.closest('[data-loan]');
  const title = loan.querySelector('h3').textContent;
  if (!confirm(`¿Devolver “${title}”?`)) return;

  button.disabled = true;
  try {
    await api(`/api/loans/${loan.dataset.loan}/return`, { method: 'PUT' });
    reloadWith(`Devolviste “${title}”. ¡Gracias!`);
  } catch (error) {
    toast(error.message, { type: 'error' });
    button.disabled = false;
  }
});
