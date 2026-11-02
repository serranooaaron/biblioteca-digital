import { api, reloadWith, toast } from './app.js';

const failWith = (button) => (error) => {
  toast(error.message, { type: 'error' });
  if (button) button.disabled = false;
};

/* ---------- Libros ---------- */
const dialog = document.getElementById('book-dialog');
const form = document.getElementById('book-form');
const errorEl = form.querySelector('[data-form-error]');
let editingId = null;

const openBookForm = (book) => {
  editingId = book?._id ?? null;
  form.reset();
  errorEl.textContent = '';
  document.getElementById('book-dialog-title').textContent = editingId ? 'Editar libro' : 'Nuevo libro';
  if (book) {
    form.elements.title.value = book.title;
    form.elements.author.value = book.author;
    form.elements.publishedYear.value = book.publishedYear;
  }
  dialog.showModal();
  form.elements.title.focus();
};

document.querySelector('[data-new-book]')?.addEventListener('click', () => openBookForm(null));
dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => dialog.close()));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';
  if (!form.checkValidity()) {
    const invalid = form.querySelector(':invalid');
    errorEl.textContent = `${invalid.labels?.[0]?.textContent ?? 'Campo'}: ${invalid.validationMessage}`;
    invalid.focus();
    return;
  }

  const data = new FormData(form);
  const hasCover = form.elements.cover.files.length > 0;
  if (!hasCover) data.delete('cover');

  // Alta con portada -> /withcover (multipart); alta sin portada -> JSON; edición -> PUT multipart.
  let request;
  if (editingId) request = api(`/api/books/${editingId}`, { method: 'PUT', body: data });
  else if (hasCover) request = api('/api/books/withcover', { method: 'POST', body: data });
  else request = api('/api/books', { method: 'POST', body: Object.fromEntries(data) });

  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await request;
    reloadWith(editingId ? 'Libro actualizado' : 'Libro agregado al catálogo');
  } catch (error) {
    errorEl.textContent = error.message === 'Incomplete values' ? 'Completa todos los campos' : error.message;
    submit.disabled = false;
  }
});

document.querySelector('[data-books-table]')?.addEventListener('click', (event) => {
  const row = event.target.closest('[data-book]');
  if (!row) return;
  const book = JSON.parse(row.dataset.book);

  if (event.target.closest('[data-edit-book]')) return openBookForm(book);

  const del = event.target.closest('[data-delete-book]');
  if (del && confirm(`¿Borrar “${book.title}” del catálogo?`)) {
    del.disabled = true;
    api(`/api/books/${book._id}`, { method: 'DELETE' }).then(() => reloadWith('Libro borrado'), failWith(del));
  }
});

/* ---------- Préstamos ---------- */
document.querySelector('[data-lend-form]')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const lendForm = event.currentTarget;
  const { uid, bid } = Object.fromEntries(new FormData(lendForm));
  if (!uid || !bid) return toast('Elige un usuario y un libro', { type: 'error' });
  const submit = lendForm.querySelector('[type="submit"]');
  submit.disabled = true;
  api(`/api/loans/${uid}/${bid}`, { method: 'POST' }).then(() => reloadWith('Préstamo registrado'), failWith(submit));
});

document.querySelector('[data-loans-table]')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-return-loan]');
  if (!button) return;
  const row = button.closest('[data-loan]');
  if (!confirm('¿Registrar la devolución de este libro?')) return;
  button.disabled = true;
  api(`/api/loans/${row.dataset.loan}/return`, { method: 'PUT' }).then(() => reloadWith('Devolución registrada'), failWith(button));
});

/* ---------- Usuarios ---------- */
const usersTable = document.querySelector('[data-users-table]');

usersTable?.addEventListener('change', (event) => {
  const select = event.target.closest('[data-role]');
  if (!select) return;
  const row = select.closest('[data-user]');
  const previous = select.querySelector('[selected]')?.value;
  select.disabled = true;
  api(`/api/users/${row.dataset.user}`, { method: 'PUT', body: { role: select.value } })
    .then(() => {
      toast(`${row.dataset.userName} ahora es ${select.value === 'admin' ? 'administrador' : 'lector'}`);
      select.querySelectorAll('option').forEach((option) => option.toggleAttribute('selected', option.value === select.value));
      select.disabled = false;
    })
    .catch((error) => {
      toast(error.message, { type: 'error' });
      if (previous) select.value = previous;
      select.disabled = false;
    });
});

usersTable?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-user]');
  if (!button) return;
  const row = button.closest('[data-user]');
  if (!confirm(`¿Borrar la cuenta de ${row.dataset.userName}?`)) return;
  button.disabled = true;
  api(`/api/users/${row.dataset.user}`, { method: 'DELETE' }).then(() => reloadWith('Usuario borrado'), failWith(button));
});
