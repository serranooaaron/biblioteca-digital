import { api } from './app.js';

// Mensajes de la API que vale la pena mostrar en español.
const MESSAGES = {
  'User already exists': 'Ya existe una cuenta con ese email',
  'Incomplete values': 'Completa todos los campos',
};

// Formularios de login y registro: validan en el navegador, llaman a la API
// y, si todo sale bien, vuelven a la página desde donde se pidió el login.
document.querySelectorAll('[data-auth-form]').forEach((form) => {
  const errorEl = form.querySelector('[data-form-error]');
  const submit = form.querySelector('[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';

    if (!form.checkValidity()) {
      const invalid = form.querySelector(':invalid');
      errorEl.textContent = invalid.validationMessage;
      invalid.focus();
      return;
    }

    submit.disabled = true;
    try {
      await api(form.dataset.authForm, { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      window.location.href = form.dataset.next || '/catalogo';
    } catch (error) {
      errorEl.textContent = MESSAGES[error.message] || error.message;
      submit.disabled = false;
    }
  });
});
