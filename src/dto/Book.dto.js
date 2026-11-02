import path from 'path';

// Las portadas viejas se guardaban con la ruta del disco del servidor
// (ej. ".../src/utils/../public/img/123-tapa.jpg"). Se convierten a la URL pública /img/123-tapa.jpg.
const toPublicCover = (cover) => {
  if (!cover) return '';
  if (cover.startsWith('/img/') || /^https?:\/\//.test(cover)) return cover;
  if (/[\\/]public[\\/]img[\\/]/.test(cover)) return `/img/${path.basename(cover.replace(/\\/g, '/'))}`;
  return cover;
};

export default class BookDTO {
  static getBookInputFrom(book) {
    return {
      title: book.title || '',
      author: book.author || '',
      publishedYear: Number(book.publishedYear),
      cover: book.cover || '',
      available: true,
    };
  }

  static getPublicFrom(book) {
    const plain = typeof book.toObject === 'function' ? book.toObject() : book;
    return { ...plain, cover: toPublicCover(plain.cover) };
  }
}
