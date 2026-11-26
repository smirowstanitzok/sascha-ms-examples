// src/book.ts
export type Book = {
  isbn: string;
  title: string;
  author: string;
  blurb: string; // cover text – the embedding is built from it
  genre: string; // partition key of the vector index
  lang: 'de' | 'en';
  year: number;
  price: number;
};

export function parseBook(input: unknown): Book {
  const b = input as Partial<Book>;
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  if (!text(b.isbn) || !text(b.title) || !text(b.author) || !text(b.blurb) || !text(b.genre)) {
    throw new Error('isbn, title, author, blurb and genre are required');
  }
  if (b.lang !== 'de' && b.lang !== 'en') throw new Error('lang must be "de" or "en"');
  if (!Number.isInteger(b.year) || typeof b.price !== 'number' || b.price < 0) {
    throw new Error('year must be an integer and price a number >= 0');
  }
  return b as Book;
}

// Title and cover text together carry the meaning of the book
export const textForEmbedding = (book: Book) => `${book.title}. ${book.blurb}`;
