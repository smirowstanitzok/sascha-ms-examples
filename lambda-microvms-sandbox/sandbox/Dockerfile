# sandbox/Dockerfile
FROM node:26-alpine

WORKDIR /app
COPY execute.ts server.ts ./

# Run as unprivileged user, snippets cannot change the runner files
RUN chown -R root:root /app && chmod -R a-w /app
USER node

EXPOSE 8080
# Node.js 24 runs TypeScript directly (type stripping)
CMD ["node", "server.ts"]
