// scripts/build-edge.mjs – bundles the Lambda@Edge function and inlines the configuration
import { build } from 'esbuild';

const { USER_POOL_ID, USER_POOL_CLIENT_ID } = process.env;
if (!USER_POOL_ID || !USER_POOL_CLIENT_ID) {
  throw new Error('Please set USER_POOL_ID and USER_POOL_CLIENT_ID');
}

await build({
  entryPoints: ['edge/member-auth.ts'],
  outfile: 'dist/member-auth/index.js',
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  define: {
    'process.env.USER_POOL_ID': JSON.stringify(USER_POOL_ID),
    'process.env.USER_POOL_CLIENT_ID': JSON.stringify(USER_POOL_CLIENT_ID)
  }
});
console.log('dist/member-auth/index.js built');
