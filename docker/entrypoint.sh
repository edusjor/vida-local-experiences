#!/bin/sh
set -e

echo "[entrypoint] Starting container..."

if [ "${RUN_DB_GENERATE:-true}" = "true" ]; then
  echo "[entrypoint] Running prisma generate"
  npx prisma generate
fi

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy"
  npx prisma migrate deploy
fi

if [ "${RUN_DB_PUSH:-false}" = "true" ]; then
  echo "[entrypoint] Running prisma db push"
  npx prisma db push --skip-generate
fi

exec "$@"
