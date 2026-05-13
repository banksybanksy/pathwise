# Pathwise Application

This folder contains the runnable Pathwise product code: the Express backend, MySQL migrations, route modules, frontend prototype, shared services, and smoke tests.

## Layout

- `server.js` - application entry point and API route mounting.
- `routes/` - Express route modules grouped by product area.
- `services/` - shared backend logic for activity logs, AI goal planning, and recommendation previews.
- `db/migrations/` - ordered SQL migrations plus a fresh database bootstrap script.
- `vertical-prototype/` - frontend pages, CSS, and client-side JavaScript.
- `middleware/` - auth, role, and validation helpers.
- `tests/` - Jest/Supertest API smoke coverage.

## Local Run

```bash
npm install
cp .env.example .env
npm start
```

The app serves the frontend and API from `http://localhost:3000` by default.

## Tests

```bash
npm test
```
