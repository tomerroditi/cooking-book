import { Hono } from 'hono';

const app = new Hono();

/* ----------------------------- helpers ----------------------------- */

const json = (c, data, status = 200) => c.json(data, status);
const bad = (c, msg, status = 400) => c.json({ error: msg }, status);
const newId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

// Round a scaled quantity to a friendly value.
function prettyQty(n) {
  if (n === null || n === undefined) return null;
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? r : parseFloat(r.toFixed(2));
}

async function loadRecipe(db, id, servings) {
  const recipe = await db.prepare('SELECT * FROM recipes WHERE id = ?').bind(id).first();
  if (!recipe) return null;

  const [ing, steps, tags] = await Promise.all([
    db.prepare('SELECT id, position, quantity, unit, name, scalable FROM ingredients WHERE recipe_id = ? ORDER BY position, id').bind(id).all(),
    db.prepare('SELECT id, position, instruction FROM steps WHERE recipe_id = ? ORDER BY position, id').bind(id).all(),
    db.prepare('SELECT t.name FROM tags t JOIN recipe_tags rt ON rt.tag_id = t.id WHERE rt.recipe_id = ? ORDER BY t.name').bind(id).all(),
  ]);

  const base = recipe.servings || 1;
  const target = servings && servings > 0 ? servings : base;
  const factor = target / base;

  const ingredients = ing.results.map((row) => ({
    id: row.id,
    position: row.position,
    unit: row.unit,
    name: row.name,
    scalable: !!row.scalable,
    quantity: row.quantity,
    scaledQuantity: row.quantity === null ? null : prettyQty(row.scalable ? row.quantity * factor : row.quantity),
  }));

  return {
    ...recipe,
    scalable: undefined,
    baseServings: base,
    servings: target,
    scaleFactor: parseFloat(factor.toFixed(3)),
    tags: tags.results.map((t) => t.name),
    ingredients,
    steps: steps.results,
  };
}

/* ------------------------------ books ------------------------------ */

app.get('/api/books', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT b.*, (SELECT COUNT(*) FROM recipes r WHERE r.book_id = b.id) AS recipe_count
     FROM books b ORDER BY b.created_at DESC, b.title`
  ).all();
  return json(c, results);
});

app.post('/api/books', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.title || !body.title.trim()) return bad(c, 'title is required');
  const id = newId('bk');
  await c.env.DB.prepare(
    'INSERT INTO books (id, title, author, description, color) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.title.trim(), body.author || null, body.description || null, body.color || '#e07a5f').run();
  return json(c, { id }, 201);
});

app.put('/api/books/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const existing = await c.env.DB.prepare('SELECT id FROM books WHERE id = ?').bind(id).first();
  if (!existing) return bad(c, 'book not found', 404);
  await c.env.DB.prepare(
    'UPDATE books SET title = COALESCE(?, title), author = ?, description = ?, color = COALESCE(?, color) WHERE id = ?'
  ).bind(body.title ?? null, body.author ?? null, body.description ?? null, body.color ?? null, id).run();
  return json(c, { ok: true });
});

app.delete('/api/books/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM books WHERE id = ?').bind(id).run();
  return json(c, { ok: true });
});

/* ------------------------------ meta ------------------------------- */

app.get('/api/meta', async (c) => {
  const [cuisines, categories, tags] = await Promise.all([
    c.env.DB.prepare("SELECT DISTINCT cuisine FROM recipes WHERE cuisine IS NOT NULL AND cuisine <> '' ORDER BY cuisine").all(),
    c.env.DB.prepare("SELECT DISTINCT category FROM recipes WHERE category IS NOT NULL AND category <> '' ORDER BY category").all(),
    c.env.DB.prepare('SELECT name FROM tags ORDER BY name').all(),
  ]);
  return json(c, {
    cuisines: cuisines.results.map((r) => r.cuisine),
    categories: categories.results.map((r) => r.category),
    tags: tags.results.map((r) => r.name),
  });
});

/* ----------------------------- recipes ----------------------------- */

app.get('/api/recipes', async (c) => {
  const q = (c.req.query('q') || '').trim();
  const book = c.req.query('book');
  const cuisine = c.req.query('cuisine');
  const category = c.req.query('category');
  const difficulty = c.req.query('difficulty');
  const tag = c.req.query('tag');
  const maxTime = parseInt(c.req.query('maxTime') || '', 10);

  const where = [];
  const binds = [];

  if (q) {
    where.push(`r.id IN (
      SELECT r2.id FROM recipes r2
      LEFT JOIN ingredients i ON i.recipe_id = r2.id
      LEFT JOIN recipe_tags rt ON rt.recipe_id = r2.id
      LEFT JOIN tags t ON t.id = rt.tag_id
      WHERE r2.title LIKE ?1 OR r2.description LIKE ?1 OR r2.cuisine LIKE ?1
         OR i.name LIKE ?1 OR t.name LIKE ?1)`);
    binds.push(`%${q}%`);
  }
  const p = () => `?${binds.length + 1}`;
  if (book) { where.push(`r.book_id = ${p()}`); binds.push(book); }
  if (cuisine) { where.push(`r.cuisine = ${p()}`); binds.push(cuisine); }
  if (category) { where.push(`r.category = ${p()}`); binds.push(category); }
  if (difficulty) { where.push(`r.difficulty = ${p()}`); binds.push(difficulty); }
  if (Number.isFinite(maxTime)) { where.push(`(COALESCE(r.prep_minutes,0) + COALESCE(r.cook_minutes,0)) <= ${p()}`); binds.push(maxTime); }
  if (tag) {
    where.push(`r.id IN (SELECT rt.recipe_id FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id WHERE t.name = ${p()})`);
    binds.push(tag);
  }

  const sql = `SELECT r.*, b.title AS book_title, b.color AS book_color
    FROM recipes r JOIN books b ON b.id = r.book_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.created_at DESC, r.title`;

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();

  // attach tags for each recipe (small dataset, one extra query)
  const tagRows = await c.env.DB.prepare(
    'SELECT rt.recipe_id, t.name FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id'
  ).all();
  const tagMap = {};
  for (const row of tagRows.results) (tagMap[row.recipe_id] ||= []).push(row.name);

  return json(c, results.map((r) => ({
    ...r,
    total_minutes: (r.prep_minutes || 0) + (r.cook_minutes || 0),
    tags: tagMap[r.id] || [],
  })));
});

app.get('/api/recipes/:id', async (c) => {
  const servings = parseInt(c.req.query('servings') || '', 10);
  const recipe = await loadRecipe(c.env.DB, c.req.param('id'), Number.isFinite(servings) ? servings : undefined);
  if (!recipe) return bad(c, 'recipe not found', 404);
  return json(c, recipe);
});

async function upsertRecipe(c, id, isNew) {
  const b = await c.req.json().catch(() => ({}));
  if (!b.title || !b.title.trim()) return bad(c, 'title is required');
  if (!b.book_id) return bad(c, 'book_id is required');

  const db = c.env.DB;
  const stmts = [];

  if (isNew) {
    stmts.push(db.prepare(
      `INSERT INTO recipes (id, book_id, title, description, image_key, servings, prep_minutes, cook_minutes, difficulty, cuisine, category)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, b.book_id, b.title.trim(), b.description || null, b.image_key || null,
      b.servings || 4, b.prep_minutes || 0, b.cook_minutes || 0, b.difficulty || 'easy', b.cuisine || null, b.category || null));
  } else {
    stmts.push(db.prepare(
      `UPDATE recipes SET book_id=?, title=?, description=?, image_key=COALESCE(?, image_key),
         servings=?, prep_minutes=?, cook_minutes=?, difficulty=?, cuisine=?, category=? WHERE id=?`
    ).bind(b.book_id, b.title.trim(), b.description || null, b.image_key || null,
      b.servings || 4, b.prep_minutes || 0, b.cook_minutes || 0, b.difficulty || 'easy', b.cuisine || null, b.category || null, id));
    stmts.push(db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').bind(id));
    stmts.push(db.prepare('DELETE FROM steps WHERE recipe_id = ?').bind(id));
    stmts.push(db.prepare('DELETE FROM recipe_tags WHERE recipe_id = ?').bind(id));
  }

  (b.ingredients || []).forEach((ing, idx) => {
    if (!ing || !ing.name || !ing.name.trim()) return;
    const qty = ing.quantity === '' || ing.quantity === null || ing.quantity === undefined ? null : Number(ing.quantity);
    stmts.push(db.prepare(
      'INSERT INTO ingredients (recipe_id, position, quantity, unit, name, scalable) VALUES (?,?,?,?,?,?)'
    ).bind(id, idx, Number.isFinite(qty) ? qty : null, ing.unit || null, ing.name.trim(), ing.scalable === false ? 0 : 1));
  });

  (b.steps || []).forEach((step, idx) => {
    const text = (typeof step === 'string' ? step : step?.instruction || '').trim();
    if (!text) return;
    stmts.push(db.prepare('INSERT INTO steps (recipe_id, position, instruction) VALUES (?,?,?)').bind(id, idx, text));
  });

  for (const name of (b.tags || [])) {
    const clean = String(name).trim().toLowerCase();
    if (!clean) continue;
    stmts.push(db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').bind(clean));
    stmts.push(db.prepare('INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) SELECT ?, id FROM tags WHERE name = ?').bind(id, clean));
  }

  await db.batch(stmts);
  return json(c, { id }, isNew ? 201 : 200);
}

app.post('/api/recipes', (c) => upsertRecipe(c, newId('rc'), true));

app.put('/api/recipes/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM recipes WHERE id = ?').bind(id).first();
  if (!existing) return bad(c, 'recipe not found', 404);
  return upsertRecipe(c, id, false);
});

app.delete('/api/recipes/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM recipes WHERE id = ?').bind(c.req.param('id')).run();
  return json(c, { ok: true });
});

/* ------------------------------ images ----------------------------- */

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

app.post('/api/images', async (c) => {
  const ct = c.req.header('content-type') || 'application/octet-stream';
  const buf = await c.req.arrayBuffer();
  if (!buf || buf.byteLength === 0) return bad(c, 'empty image body');
  if (buf.byteLength > MAX_IMAGE_BYTES) return bad(c, 'image too large (max 8MB)', 413);
  if (!ct.startsWith('image/')) return bad(c, 'body must be an image/* content-type');
  const key = `img_${crypto.randomUUID()}`;
  await c.env.IMAGES.put(key, buf, { metadata: { contentType: ct } });
  return json(c, { key, url: `/api/images/${key}` }, 201);
});

app.get('/api/images/:key', async (c) => {
  const key = c.req.param('key');
  const obj = await c.env.IMAGES.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!obj || !obj.value) return c.text('not found', 404);
  return new Response(obj.value, {
    headers: {
      'content-type': obj.metadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
});

/* --------------------------- health + SPA -------------------------- */

app.get('/api/health', (c) => json(c, { ok: true, service: 'cooking-book' }));
app.all('/api/*', (c) => bad(c, 'not found', 404));

// Everything else is served from static assets (SPA).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
