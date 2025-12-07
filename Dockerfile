### Multi-stage Dockerfile: build smaller runtime image and use npm ci
FROM node:20-bullseye as builder
WORKDIR /app
COPY package*.json ./
# Install all deps (including dev for build/lint if needed)
RUN npm ci --omit=dev

# Copy app sources
COPY . .

# Final stage: use lightweight runtime image
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Copy installed production deps from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app .

EXPOSE 5000

# Use non-root user for better security in production
RUN useradd --uid 1000 --create-home appuser || true
USER appuser

CMD ["npm","start"]
