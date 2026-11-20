// src/ausleihen.ts
// Data access interface – the handler only knows this interface.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export interface Ausleihe {
  ausleiheId: string;
  radId: string;
  startAm: string;
  zurueckAm?: string;
  gebuehrCent?: number;
}

export interface AusleihenRepository {
  laden(ausleiheId: string): Promise<Ausleihe | undefined>;
  abschliessen(ausleiheId: string, zurueckAm: string, gebuehrCent: number): Promise<void>;
}

export class DynamoAusleihenRepository implements AusleihenRepository {
  private readonly doc: DynamoDBDocumentClient;
  private readonly tabelle: string;

  constructor(tabelle: string, client = new DynamoDBClient({})) {
    this.tabelle = tabelle;
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async laden(ausleiheId: string): Promise<Ausleihe | undefined> {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tabelle, Key: { ausleiheId } }),
    );
    return res.Item as Ausleihe | undefined;
  }

  async abschliessen(ausleiheId: string, zurueckAm: string, gebuehrCent: number): Promise<void> {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tabelle,
        Key: { ausleiheId },
        UpdateExpression: 'SET zurueckAm = :z, gebuehrCent = :g',
        ConditionExpression: 'attribute_not_exists(zurueckAm)',
        ExpressionAttributeValues: { ':z': zurueckAm, ':g': gebuehrCent },
      }),
    );
  }
}
