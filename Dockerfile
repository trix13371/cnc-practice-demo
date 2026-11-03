FROM node:24.22.1-alpine
# The application uses only Node built-ins. Package managers are not needed at runtime.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-v* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg /usr/local/bin/corepack
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node *.js *.css index.html ./
COPY --chown=node:node styles/ ./styles/
COPY --chown=node:node scripts/build-styles.cjs ./scripts/build-styles.cjs
COPY --chown=node:node assets/ ./assets/
COPY --chown=node:node server/ ./server/
RUN node scripts/build-styles.cjs
RUN mkdir -p /data /backups && chown node:node /data /backups
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.cjs"]
