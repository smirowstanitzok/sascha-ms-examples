// scripts/seed.ts
// Usage: API_URL=https://xxxx.execute-api.eu-central-1.amazonaws.com npm run seed
const API_URL = process.env.API_URL;
if (!API_URL) throw new Error('Please set API_URL (output of "serverless deploy")');

const books = [
  { isbn: '978-0-00-000001-1', title: 'Fog over the Harbour', author: 'Mara Holm', genre: 'crime', lang: 'de', year: 2023, price: 14.99,
    blurb: 'A detective investigates in a port town where a smuggling ring covers its tracks.' },
  { isbn: '978-0-00-000002-8', title: 'The Silent Witness', author: 'Jonas Reef', genre: 'crime', lang: 'de', year: 2019, price: 11.0,
    blurb: 'A courtroom thriller about a witness who knows too much and suddenly disappears.' },
  { isbn: '978-0-00-000003-5', title: 'Salt and Silence', author: 'Ada Brook', genre: 'crime', lang: 'en', year: 2024, price: 18.5,
    blurb: 'A detective follows smugglers through a foggy harbour town on the North Sea coast.' },
  { isbn: '978-0-00-000004-2', title: 'Baking with Sourdough', author: 'Lena Korn', genre: 'cooking', lang: 'de', year: 2022, price: 24.0,
    blurb: 'From the first starter to a crusty country loaf, explained step by step.' },
  { isbn: '978-0-00-000005-9', title: 'The Gardener on the Dike', author: 'Mara Holm', genre: 'novel', lang: 'de', year: 2021, price: 12.99,
    blurb: 'A woman takes over an overgrown garden on the coast and finds herself along the way.' },
];

for (const book of books) {
  const response = await fetch(`${API_URL}/books`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(book),
  });
  console.log(response.status, book.title);
}
