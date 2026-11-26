# Dockerfile
FROM public.ecr.aws/docker/library/node:26-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM public.ecr.aws/docker/library/node:26-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/src/main.js"]
