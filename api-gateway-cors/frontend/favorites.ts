// frontend/favorites.ts
const FAVORITES_URL = 'https://xyz789.lambda-url.eu-central-1.on.aws/';

export async function saveFavorites(bikeIds: string[]): Promise<string[]> {
  const res = await fetch(FAVORITES_URL, {
    method: 'PUT',
    credentials: 'include', // send cookies to other origins as well
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bikeIds }),
  });
  const data = (await res.json()) as { favorites: string[] };
  return data.favorites;
}
