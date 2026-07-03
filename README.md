# 🍳 The Cooking Book

A personal cooking book web app built on **Cloudflare Workers**, **D1** (SQLite) and **KV** (image storage). Organise recipes into books, upload photos, search and filter, and automatically scale ingredient quantities for any number of servings.

Live app (after first deploy): `https://cooking-book.<your-subdomain>.workers.dev`

## Features

- **Recipe books** — group recipes into colour-coded books; create your own.
- **Recipes** — title, description, photo, prep/cook time, difficulty, cuisine, category, ingredients, step-by-step method and tags.
- **Serving-size calculator** — set any target servings and every scalable ingredient recalculates instantly (fixed "to taste" items stay put).
- **Search** — full-text across titles, descriptions, ingredients, cuisines and tags.
- **Filters** — by book, cuisine, category, difficulty, tag and maximum total time.
- **Image upload** — photos are stored in Cloudflare KV and served through the Worker.
- **Full CRUD** — add / edit / delete books and recipes from the UI.

## Architecture

| Layer      | Tech |
|------------|------|
| Runtime    | Cloudflare Workers (zero-dependency, native `fetch` handler) |
| Database   | Cloudflare D1 (`cooking-book-db`) |
| Images     | Cloudflare KV (`cooking-book-images`) |
| Frontend   | Vanilla JS SPA served via Workers Static Assets (`/public`) |

The Worker serves the API under `/api/*` and everything else from static assets, with a single-page-app fallback.

### API

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/api/books` | list books with recipe counts |
| POST   | `/api/books` | create a book |
| PUT/DELETE | `/api/books/:id` | update / delete a book |
| GET    | `/api/recipes` | list recipes (`?q=&book=&cuisine=&category=&difficulty=&tag=&maxTime=`) |
| GET    | `/api/recipes/:id` | full recipe (`?servings=N` to scale) |
| POST   | `/api/recipes` | create a recipe (with ingredients, steps, tags) |
| PUT/DELETE | `/api/recipes/:id` | update / delete a recipe |
| GET    | `/api/meta` | distinct cuisines, categories and tags for filters |
| POST   | `/api/images` | upload an image (raw `image/*` body) → `{ key }` |
| GET    | `/api/images/:key` | serve an image from KV |

## Local development

```bash
npm install
npm run db:schema:local   # create tables in the local D1
npm run db:seed:local     # load sample recipes
npm run dev               # http://localhost:8787
```

## Deployment

Deployment is handled by **Cloudflare Workers Builds** (the repo is connected to the
Worker via Git). Every push to the branch triggers `npx wrangler deploy` on
Cloudflare's build runners — no API tokens or GitHub secrets required. The Worker has
no npm dependencies, so no build step is needed.

Recommended build settings (Workers & Pages → project → Settings → Builds):

| Setting | Value |
|---|---|
| Build command | `npm install` *(optional — the Worker has no dependencies)* |
| Deploy command | `npx wrangler deploy` |
| Root directory | *(blank — repo root, where `wrangler.toml` lives)* |

To deploy from your own machine instead:

```bash
npx wrangler login
npm run db:schema:remote
npm run db:seed:remote     # optional: sample data (already loaded in production)
npm run deploy
```

## Cloudflare resources (already provisioned)

- D1 database `cooking-book-db` — id `e74fba71-be7e-4466-a1aa-1f0597678302`
- KV namespace `cooking-book-images` — id `3db31edddb534a4f9cad93b78b4d36bb`

Bindings are declared in `wrangler.toml` (`DB`, `IMAGES`, `ASSETS`).
