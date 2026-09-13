set -eu
if [ ! -f .env ]; then cp .env.example .env; fi
npm ci
npm run db:generate
npm run db:deploy
npm run cards:import
npm run check
npm run smoke
