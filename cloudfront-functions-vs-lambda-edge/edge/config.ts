// edge/config.ts – values are inlined at build time (Lambda@Edge has no environment variables)
export const config = {
  userPoolId: process.env.USER_POOL_ID ?? '',
  clientId: process.env.USER_POOL_CLIENT_ID ?? '',
  loginPath: '/anmelden/'
};
