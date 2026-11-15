// cdk/app.ts
import { App } from 'aws-cdk-lib';
import { FavoritesStack } from './favorites-stack.ts';

const app = new App();
new FavoritesStack(app, 'BikeRentalFavorites', {
  env: { region: 'eu-central-1' },
  frontendOrigins: ['https://app.bike-rental.example', 'http://localhost:5173'],
});
