// src/rueckgabe.ts
// Lambda handler: POST /ausleihen/{ausleiheId}/rueckgabe (return a bike)
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { AusleihenRepository } from './ausleihen.ts';
import { berechneGebuehr } from './gebuehr.ts';

const antwort = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export function erstelleRueckgabeHandler(repo: AusleihenRepository) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const ausleiheId = event.pathParameters?.ausleiheId;
    if (!ausleiheId) {
      return antwort(400, { error: 'ausleiheId is missing' });
    }

    const ausleihe = await repo.laden(ausleiheId);
    if (!ausleihe) {
      return antwort(404, { error: 'Rental not found' });
    }
    if (ausleihe.zurueckAm) {
      return antwort(409, { error: 'Bike has already been returned' });
    }

    const jetzt = new Date().toISOString();
    const gebuehrCent = berechneGebuehr(ausleihe.startAm, jetzt);
    await repo.abschliessen(ausleiheId, jetzt, gebuehrCent);

    return antwort(200, { ausleiheId, radId: ausleihe.radId, zurueckAm: jetzt, gebuehrCent });
  };
}
