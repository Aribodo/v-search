# Client — Kattalog Frontend

React frontend for the Kattalog semantic search platform. Provides a search interface and file upload UI that connects to the Express backend.

## Tech Stack

- React 18, TypeScript, Vite
- Tailwind CSS + shadcn/ui
- React Router, React Query

## Running

```sh
npm install
npm run dev
```

Runs on `http://localhost:3000` by default.

## Environment Variables

Set in a `.env` file:

| Variable       | Description               | Default                    |
|----------------|---------------------------|----------------------------|
| `VITE_API_URL` | Backend API base URL      | `http://localhost:4000`    |
