import { api, reloadWith } from './app.js';
import { passwordChecks } from './passwordPolicy.js';

// Valida en el navegador antes de enviar: marca el campo, lo enfoca y muestra el motivo.
const firstInvalid = (form, errorEl) => {
  form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid'));
  if (form.checkValidity()) return false;
  const invalid = form.querySelector(':invalid');
  const fieldName = invalid.labels?.[0]?.textContent.trim();
  errorEl.textContent = `${fieldName ? `${fieldName}: ` : ''}${invalid.validationMessage}`;
  invalid.setAttribute('aria-invalid', 'true');
  invalid.focus();
  return true;
};

// Envía el formulario con el botón deshabilitado: un doble clic no manda dos cambios.
const sendForm = (form, { url, body, done }) => {
  const errorEl = form.querySelector('[data-form-error]');
  const submit = form.querySelector('[type="submit"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';
    if (firstInvalid(form, errorEl)) return;
    const label = submit.textContent;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submit.textContent = 'Guardando…';
    try {
      const data = await api(url, { method: 'PUT', body: body() });
      done(data);
    } catch (error) {
      errorEl.textContent = error.message;
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.textContent = label;
    }
  });
};

const profileForm = document.querySelector('[data-profile-form]');
sendForm(profileForm, {
  url: '/api/sessions/profile',
  body: () => Object.fromEntries(new FormData(profileForm)),
  done: () => reloadWith('Datos guardados'),
});

// Contraseña nueva: la misma lista de requisitos que el registro, marcada mientras se escribe.
const passwordForm = document.querySelector('[data-password-form]');
const newPassword = passwordForm.querySelector('[data-password]');
const rulesList = passwordForm.querySelector('[data-password-rules]');
const person = { email: passwordForm.dataset.email, first_name: passwordForm.dataset.firstName, last_name: passwordForm.dataset.lastName };
const updateRules = () => {
  const checks = passwordChecks(newPassword.value, person);
  for (const { id, ok } of checks) {
    const item = rulesList.querySelector(`[data-rule="${id}"]`);
    item.classList.toggle('is-ok', ok);
    item.querySelector('[data-rule-state]').textContent = ok ? ': cumplido' : ': falta';
  }
  const missing = checks.filter((check) => !check.ok);
  newPassword.setCustomValidity(missing.length ? `La contraseña necesita: ${missing.map((check) => check.label.toLowerCase()).join(', ')}` : '');
};
newPassword.addEventListener('input', updateRules);
updateRules();

sendForm(passwordForm, {
  url: '/api/sessions/password',
  body: () => Object.fromEntries(new FormData(passwordForm)),
  done: (data) => reloadWith(data.message),
});
