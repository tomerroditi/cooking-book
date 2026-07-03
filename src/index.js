/* The Cooking Book — Cloudflare Worker (zero dependencies).
   Serves a JSON API under /api/* and static assets for everything else. */

/* ------------------------------ helpers ------------------------------ */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const newId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const readJson = (request) => request.json().catch(() => ({}));

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
    baseServings: base,
    servings: target,
    scaleFactor: parseFloat(factor.toFixed(3)),
    tags: tags.results.map((t) => t.name),
    ingredients,
    steps: steps.results,
  };
}

/* ------------------------------- books ------------------------------- */

async function listBooks(env) {
  const { results } = await env.DB.prepare(
    `SELECT b.*, (SELECT COUNT(*) FROM recipes r WHERE r.book_id = b.id) AS recipe_count
     FROM books b ORDER BY b.created_at DESC, b.title`
  ).all();
  return json(results);
}

async function createBook(request, env) {
  const body = await readJson(request);
  if (!body.title || !body.title.trim()) return bad('title is required');
  const id = newId('bk');
  await env.DB.prepare('INSERT INTO books (id, title, author, description, color) VALUES (?, ?, ?, ?, ?)')
    .bind(id, body.title.trim(), body.author || null, body.description || null, body.color || '#e07a5f').run();
  return json({ id }, 201);
}

async function updateBook(request, env, id) {
  const body = await readJson(request);
  const existing = await env.DB.prepare('SELECT id FROM books WHERE id = ?').bind(id).first();
  if (!existing) return bad('book not found', 404);
  await env.DB.prepare('UPDATE books SET title = COALESCE(?, title), author = ?, description = ?, color = COALESCE(?, color) WHERE id = ?')
    .bind(body.title ?? null, body.author ?? null, body.description ?? null, body.color ?? null, id).run();
  return json({ ok: true });
}

async function deleteBook(env, id) {
  await env.DB.prepare('DELETE FROM books WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

/* -------------------------------- meta ------------------------------- */

async function getMeta(env) {
  const [cuisines, categories, tags] = await Promise.all([
    env.DB.prepare("SELECT DISTINCT cuisine FROM recipes WHERE cuisine IS NOT NULL AND cuisine <> '' ORDER BY cuisine").all(),
    env.DB.prepare("SELECT DISTINCT category FROM recipes WHERE category IS NOT NULL AND category <> '' ORDER BY category").all(),
    env.DB.prepare('SELECT name FROM tags ORDER BY name').all(),
  ]);
  return json({
    cuisines: cuisines.results.map((r) => r.cuisine),
    categories: categories.results.map((r) => r.category),
    tags: tags.results.map((r) => r.name),
  });
}

/* ------------------------------ recipes ------------------------------ */

async function listRecipes(env, url) {
  const qp = url.searchParams;
  const q = (qp.get('q') || '').trim();
  const maxTime = parseInt(qp.get('maxTime') || '', 10);

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
  for (const key of ['book', 'cuisine', 'category', 'difficulty']) {
    const v = qp.get(key);
    if (v) { where.push(`r.${key === 'book' ? 'book_id' : key} = ${p()}`); binds.push(v); }
  }
  if (Number.isFinite(maxTime)) { where.push(`(COALESCE(r.prep_minutes,0) + COALESCE(r.cook_minutes,0)) <= ${p()}`); binds.push(maxTime); }
  const tag = qp.get('tag');
  if (tag) { where.push(`r.id IN (SELECT rt.recipe_id FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id WHERE t.name = ${p()})`); binds.push(tag); }

  const sql = `SELECT r.*, b.title AS book_title, b.color AS book_color
    FROM recipes r JOIN books b ON b.id = r.book_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.created_at DESC, r.title`;

  const { results } = await env.DB.prepare(sql).bind(...binds).all();

  const tagRows = await env.DB.prepare('SELECT rt.recipe_id, t.name FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id').all();
  const tagMap = {};
  for (const row of tagRows.results) (tagMap[row.recipe_id] ||= []).push(row.name);

  return json(results.map((r) => ({
    ...r,
    total_minutes: (r.prep_minutes || 0) + (r.cook_minutes || 0),
    tags: tagMap[r.id] || [],
  })));
}

async function getRecipe(env, id, url) {
  const servings = parseInt(url.searchParams.get('servings') || '', 10);
  const recipe = await loadRecipe(env.DB, id, Number.isFinite(servings) ? servings : undefined);
  if (!recipe) return bad('recipe not found', 404);
  return json(recipe);
}

async function upsertRecipe(request, env, id, isNew) {
  const b = await readJson(request);
  if (!b.title || !b.title.trim()) return bad('title is required');
  if (!b.book_id) return bad('book_id is required');

  const db = env.DB;
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
    stmts.push(db.prepare('INSERT INTO ingredients (recipe_id, position, quantity, unit, name, scalable) VALUES (?,?,?,?,?,?)')
      .bind(id, idx, Number.isFinite(qty) ? qty : null, ing.unit || null, ing.name.trim(), ing.scalable === false ? 0 : 1));
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
  return json({ id }, isNew ? 201 : 200);
}

async function deleteRecipe(env, id) {
  await env.DB.prepare('DELETE FROM recipes WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

/* ------------------------------- images ------------------------------ */

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function uploadImage(request, env) {
  const ct = request.headers.get('content-type') || 'application/octet-stream';
  const buf = await request.arrayBuffer();
  if (!buf || buf.byteLength === 0) return bad('empty image body');
  if (buf.byteLength > MAX_IMAGE_BYTES) return bad('image too large (max 8MB)', 413);
  if (!ct.startsWith('image/')) return bad('body must be an image/* content-type');
  const key = `img_${crypto.randomUUID()}`;
  await env.IMAGES.put(key, buf, { metadata: { contentType: ct } });
  return json({ key, url: `/api/images/${key}` }, 201);
}

async function serveImage(env, key) {
  const obj = await env.IMAGES.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!obj || !obj.value) return new Response('not found', { status: 404 });
  return new Response(obj.value, {
    headers: {
      'content-type': obj.metadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

/* ------------------------------- router ------------------------------ */

async function handleApi(request, env, url) {
  const seg = url.pathname.split('/').filter(Boolean); // e.g. ['api','recipes','rc_x']
  const method = request.method;
  const resource = seg[1];
  const idOrKey = seg[2] ? decodeURIComponent(seg[2]) : null;

  if (resource === 'health') return json({ ok: true, service: 'cooking-book' });

  if (resource === 'books') {
    if (!idOrKey) {
      if (method === 'GET') return listBooks(env);
      if (method === 'POST') return createBook(request, env);
    } else {
      if (method === 'PUT') return updateBook(request, env, idOrKey);
      if (method === 'DELETE') return deleteBook(env, idOrKey);
    }
  }

  if (resource === 'meta' && method === 'GET') return getMeta(env);

  if (resource === 'recipes') {
    if (!idOrKey) {
      if (method === 'GET') return listRecipes(env, url);
      if (method === 'POST') return upsertRecipe(request, env, newId('rc'), true);
    } else {
      if (method === 'GET') return getRecipe(env, idOrKey, url);
      if (method === 'PUT') {
        const existing = await env.DB.prepare('SELECT id FROM recipes WHERE id = ?').bind(idOrKey).first();
        if (!existing) return bad('recipe not found', 404);
        return upsertRecipe(request, env, idOrKey, false);
      }
      if (method === 'DELETE') return deleteRecipe(env, idOrKey);
    }
  }

  if (resource === 'images') {
    if (!idOrKey && method === 'POST') return uploadImage(request, env);
    if (idOrKey && method === 'GET') return serveImage(env, idOrKey);
  }

  return bad('not found', 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: err?.message || 'server error' }, 500);
      }
    }
    // Everything else: static assets (SPA fallback handled by wrangler config).
    return env.ASSETS.fetch(request);
  },
};
