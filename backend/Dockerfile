FROM node:20-alpine
WORKDIR /app
COPY src ./src
RUN mkdir -p /app/data && chown -R node:node /app/data
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]
