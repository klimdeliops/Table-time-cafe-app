#!/bin/sh
set -e

./node_modules/.bin/prisma migrate deploy

node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.restaurant.count().then(n => {
  p.\$disconnect();
  process.exit(n > 0 ? 0 : 1);
});
" && echo "Database already seeded, skipping." || npm run seed

node dist/main
