// Catálogo inicial: lo usan `npm run seed` (Atlas) y el modo de desarrollo en memoria.
// Los libros sin portada se muestran con una tapa generada a partir del título y el autor.
const books = [
  { title: 'Clean Code', author: 'Robert C. Martin', publishedYear: 2008 },
  { title: 'The Pragmatic Programmer', author: 'Andrew Hunt y David Thomas', publishedYear: 1999 },
  { title: 'Refactoring', author: 'Martin Fowler', publishedYear: 1999 },
  { title: 'Design Patterns', author: 'Erich Gamma y otros', publishedYear: 1994 },
  { title: 'Eloquent JavaScript', author: 'Marijn Haverbeke', publishedYear: 2011 },
  { title: 'Python Crash Course', author: 'Eric Matthes', publishedYear: 2015 },
  { title: 'Cien años de soledad', author: 'Gabriel García Márquez', publishedYear: 1967 },
  { title: 'Rayuela', author: 'Julio Cortázar', publishedYear: 1963 },
  { title: 'Ficciones', author: 'Jorge Luis Borges', publishedYear: 1944 },
  { title: 'El Aleph', author: 'Jorge Luis Borges', publishedYear: 1949 },
  { title: 'Dune', author: 'Frank Herbert', publishedYear: 1965 },
  { title: '1984', author: 'George Orwell', publishedYear: 1949 },
  { title: 'Fahrenheit 451', author: 'Ray Bradbury', publishedYear: 1953 },
  { title: 'El principito', author: 'Antoine de Saint-Exupéry', publishedYear: 1943 },
];

export default books;
