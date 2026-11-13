# agent/Dockerfile
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-slim AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npx tsc

FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY data ./data
EXPOSE 8080
CMD ["node", "dist/src/server.js"]
