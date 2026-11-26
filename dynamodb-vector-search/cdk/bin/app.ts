// bin/app.ts
import { App } from 'aws-cdk-lib';
import { BooksVectorTableStack } from '../lib/books-vector-table.ts';

new BooksVectorTableStack(new App(), 'BooksVectorTable', { env: { region: 'eu-central-1' } });
