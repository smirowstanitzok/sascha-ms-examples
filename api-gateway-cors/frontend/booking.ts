// frontend/booking.ts
const API_URL = 'https://abc123.execute-api.eu-central-1.amazonaws.com';

export async function bookBike(bikeId: string, token: string): Promise<string | null> {
  const res = await fetch(`${API_URL}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bikeId }),
  });
  if (!res.ok) throw new Error(`Booking failed: ${res.status}`);
  // Only readable because X-Booking-Id is listed in exposedResponseHeaders
  return res.headers.get('X-Booking-Id');
}
