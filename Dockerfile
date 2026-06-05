FROM node:20-alpine

WORKDIR /app

COPY status-server/package.json ./package.json
COPY status-server/server.js ./server.js

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_FILE=/data/status-data.json

EXPOSE 3000

CMD ["node", "server.js"]
