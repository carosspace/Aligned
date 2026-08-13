FROM node:20-bookworm-slim
WORKDIR /app

# Install deps first (better layer caching). No native modules → clean, fast build.
COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV DATA_DIR=/data
EXPOSE 3000

CMD ["node", "server.js"]
