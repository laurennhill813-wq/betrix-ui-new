FROM node:18
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy app sources
COPY . .

# Render injects PORT (defaults to 10000) — expose it for clarity
EXPOSE 10000

# Run the web app directly (use src/app.js which is the Express entrypoint)
CMD ["node", "src/app.js"]
