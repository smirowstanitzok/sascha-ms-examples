# runtime/Dockerfile
# Base image with Amazon Linux 2023, Node.js 24 and the Lambda runtime interface client
FROM public.ecr.aws/lambda/nodejs:24

# Shared logger for all teams: lands in /var/runtime/node_modules (on NODE_PATH)
COPY radwerk-logger/ /var/runtime/node_modules/@radwerk/logger/

# Default settings for every function on this runtime
ENV RADWERK_LOG_LEVEL=info

# No CMD: Lambda takes the handler from the function configuration
