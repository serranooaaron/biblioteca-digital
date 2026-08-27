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
}
