FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

EXPOSE 5000

# Run migrations then start server
CMD ["sh", "-c", "node src/utils/migrate.js && node src/server.js"]
