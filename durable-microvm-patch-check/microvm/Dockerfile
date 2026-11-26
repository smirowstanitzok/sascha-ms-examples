FROM public.ecr.aws/docker/library/node:26-alpine
WORKDIR /app
COPY app.mjs .
EXPOSE 8080
# Lambda takes a snapshot of the running process after it starts
CMD ["node", "app.mjs"]
