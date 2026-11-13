// src/erinnerung.ts
// Sends a reminder (just a placeholder for email or SMS here)
export default async function sendeErinnerung(leserId: string, titel: string): Promise<void> {
  console.log(`Reminder to ${leserId}: "${titel}" is overdue`);
}
