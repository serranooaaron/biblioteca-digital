// Helpers disponibles en todas las vistas de Handlebars.
const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const ratingFormatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Tono estable a partir de un texto: cada libro sin portada tiene siempre el mismo color.
const hueFrom = (text = '') => [...text].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 360, 7);

export default {
  eq: (a, b) => String(a) === String(b),
  initials: (name = '') =>
    name
      .split(/\s+/)
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  date: (value) => (value ? dateFormatter.format(new Date(value)) : ''),
  coverHue: (title) => hueFrom(title),
  encode: (value) => encodeURIComponent(value ?? ''),
  json: (value) => JSON.stringify(value),
  plural: (count, singular, plural) => (Number(count) === 1 ? singular : plural),
  // Puntaje con coma decimal ("4,5") y fila de estrellas redondeada a la más cercana.
  score: (value) => ratingFormatter.format(Number(value) || 0),
  stars: (value) => {
    const full = Math.round(Number(value) || 0);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  },
  range: (from, to) => Array.from({ length: to - from + 1 }, (_, i) => to - i),
};
