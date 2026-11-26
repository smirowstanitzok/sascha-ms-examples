// lib/books-vector-table.ts
import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';

export class BooksVectorTableStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The L2 construct does not support vector indexes yet, so we use the L1 construct CfnTable
    const table = new dynamodb.CfnTable(this, 'BooksTable', {
      billingMode: 'PAY_PER_REQUEST',
      keySchema: [{ attributeName: 'isbn', keyType: 'HASH' }],
      attributeDefinitions: [
        { attributeName: 'isbn', attributeType: 'S' },
        { attributeName: 'genre', attributeType: 'S' },
        { attributeName: 'lang', attributeType: 'S' },
        { attributeName: 'year', attributeType: 'N' },
        { attributeName: 'price', attributeType: 'N' },
      ],
      vectorIndexes: [
        {
          indexName: 'BookEmbeddingIndex',
          vectorAttribute: { attributeName: 'embedding' },
          dimensions: 512,
          distanceFunction: 'COSINE',
          searchSchema: [
            { attributeName: 'genre', searchSchemaElementType: 'HASH' },
            { attributeName: 'lang', searchSchemaElementType: 'INLINE_FILTER' },
            { attributeName: 'year', searchSchemaElementType: 'INLINE_FILTER' },
            { attributeName: 'price', searchSchemaElementType: 'INLINE_FILTER' },
          ],
          projection: { projectionType: 'INCLUDE', nonKeyAttributes: ['title', 'author'] },
        },
      ],
    });
    table.applyRemovalPolicy(RemovalPolicy.DESTROY); // for this example only

    new CfnOutput(this, 'TableName', { value: table.ref });
  }
}
