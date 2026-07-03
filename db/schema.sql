-- Cooking Book schema (Cloudflare D1 / SQLite)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS books (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  author      TEXT,
  description TEXT,
  color       TEXT DEFAULT '#e07a5f',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipes (
  id            TEXT PRIMARY KEY,
  book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  image_key     TEXT,               -- key into the IMAGES KV namespace
  servings      INTEGER NOT NULL DEFAULT 4,   -- base servings the quantities are written for
  prep_minutes  INTEGER DEFAULT 0,
  cook_minutes  INTEGER DEFAULT 0,
  difficulty    TEXT DEFAULT 'easy',          -- easy | medium | hard
  cuisine       TEXT,
  category      TEXT,                         -- e.g. Main, Dessert, Breakfast
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ingredients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  quantity   REAL,               -- nullable: "to taste"
  unit       TEXT,               -- g, ml, cup, tbsp, tsp, piece, ...
  name       TEXT NOT NULL,
  scalable   INTEGER NOT NULL DEFAULT 1   -- 1 = scales with servings, 0 = fixed
);

CREATE TABLE IF NOT EXISTS steps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id   TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  instruction TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recipe_tags (
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_book     ON recipes(book_id);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine  ON recipes(cuisine);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_steps_recipe     ON steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag  ON recipe_tags(tag_id);
