import './bookActions.js';

// Los filtros de disponibilidad y orden se aplican al cambiar, sin tocar "Buscar".
document.querySelectorAll('[data-autosubmit]').forEach((el) =>
  el.addEventListener('change', () => el.form.requestSubmit())
);
