/* The Cooking Book — front-end SPA (vanilla JS) */

const api = {
  async get(path) { const r = await fetch(path); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); return r.json(); },
  async send(method, path, body) {
    const r = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
    return r.json();
  },
  post: (p, b) => api.send('POST', p, b),
  put: (p, b) => api.send('PUT', p, b),
  del: (p) => api.send('DELETE', p),
};

const state = {
  books: [],
  meta: { cuisines: [], categories: [], tags: [] },
  filters: { q: '', book: '', cuisine: '', category: '', difficulty: '', tag: '', maxTime: '' },
  recipes: [],
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) { if (kid == null) continue; n.append(kid.nodeType ? kid : document.createTextNode(kid)); }
  return n;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function fmtTime(min) { if (!min) return '—'; if (min < 60) return `${min} min`; const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h ${m}m` : `${h}h`; }
function imgUrl(key) { return key ? `/api/images/${key}` : null; }

/* --------------------------- data loading --------------------------- */

async function loadMeta() {
  const [books, meta] = await Promise.all([api.get('/api/books'), api.get('/api/meta')]);
  state.books = books; state.meta = meta;
}

function queryString() {
  const f = state.filters; const p = new URLSearchParams();
  for (const k of ['q', 'book', 'cuisine', 'category', 'difficulty', 'tag', 'maxTime']) if (f[k]) p.set(k, f[k]);
  return p.toString();
}

async function loadRecipes() {
  state.recipes = await api.get('/api/recipes' + (queryString() ? '?' + queryString() : ''));
}

/* ------------------------------ router ------------------------------ */

async function route() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('/recipe/')) return renderDetail(hash.split('/')[2]);
  return renderList();
}

function go(hash) { location.hash = hash; }

/* ----------------------------- sidebar ------------------------------ */

function renderSidebar() {
  const f = state.filters;
  const sb = $('#sidebar'); sb.innerHTML = '';

  // books
  const bookGroup = el('div', { class: 'filter-group' }, el('h4', {}, 'Books'));
  const bookList = el('div', { class: 'book-list' });
  bookList.append(el('div', { class: 'book-item' + (f.book === '' ? ' active' : ''), onclick: () => setFilter('book', '') },
    el('span', { class: 'book-dot', style: 'background:#bbb' }), el('span', {}, 'All recipes')));
  for (const b of state.books) {
    bookList.append(el('div', { class: 'book-item' + (f.book === b.id ? ' active' : ''), onclick: () => setFilter('book', f.book === b.id ? '' : b.id) },
      el('span', { class: 'book-dot', style: `background:${esc(b.color || '#e07a5f')}` }),
      el('span', {}, b.title),
      el('span', { class: 'count' }, String(b.recipe_count))));
  }
  bookGroup.append(bookList);
  sb.append(bookGroup);

  // selects
  const selGroup = el('div', { class: 'filter-group' }, el('h4', {}, 'Refine'));
  selGroup.append(makeSelect('cuisine', 'All cuisines', state.meta.cuisines));
  selGroup.append(el('div', { style: 'height:8px' }));
  selGroup.append(makeSelect('category', 'All categories', state.meta.categories));
  selGroup.append(el('div', { style: 'height:8px' }));
  selGroup.append(makeSelect('difficulty', 'Any difficulty', ['easy', 'medium', 'hard']));
  selGroup.append(el('div', { style: 'height:8px' }));
  selGroup.append(makeSelect('maxTime', 'Any total time', [['15', 'Under 15 min'], ['30', 'Under 30 min'], ['60', 'Under 1 hour']]));
  sb.append(selGroup);

  // tags
  if (state.meta.tags.length) {
    const tagGroup = el('div', { class: 'filter-group' }, el('h4', {}, 'Tags'));
    const chips = el('div', { class: 'chip-list' });
    for (const t of state.meta.tags) {
      chips.append(el('button', { class: 'chip' + (f.tag === t ? ' active' : ''), onclick: () => setFilter('tag', f.tag === t ? '' : t) }, t));
    }
    tagGroup.append(chips);
    sb.append(tagGroup);
  }
}

function makeSelect(key, allLabel, options) {
  const sel = el('select', { class: 'select', onchange: (e) => setFilter(key, e.target.value) });
  sel.append(el('option', { value: '' }, allLabel));
  for (const o of options) {
    const [val, label] = Array.isArray(o) ? o : [o, o];
    const opt = el('option', { value: val }, label);
    if (state.filters[key] === String(val)) opt.selected = true;
    sel.append(opt);
  }
  return sel;
}

async function setFilter(key, value) {
  state.filters[key] = value;
  if (location.hash.startsWith('#/recipe/')) go('');
  await refreshList();
}

/* ------------------------------- list ------------------------------- */

async function renderList() {
  renderSidebar();
  const c = $('#content');
  c.innerHTML = '';
  c.append(el('div', { class: 'loading' }, 'Loading recipes…'));
  await refreshList();
}

async function refreshList() {
  renderSidebar();
  try { await loadRecipes(); } catch (e) { toast('Failed to load: ' + e.message); return; }
  const c = $('#content'); c.innerHTML = '';

  const activeCount = Object.entries(state.filters).filter(([k, v]) => v).length;
  const head = el('div', { class: 'content-head' },
    el('div', {},
      el('h1', {}, 'Recipes'),
      el('div', { class: 'sub' }, `${state.recipes.length} recipe${state.recipes.length === 1 ? '' : 's'}${activeCount ? ' · filtered' : ''}`)));
  c.append(head);

  // active filter pills
  const f = state.filters;
  const pills = [];
  const pillDefs = [
    ['q', f.q && `“${f.q}”`], ['book', f.book && (state.books.find((b) => b.id === f.book)?.title)],
    ['cuisine', f.cuisine], ['category', f.category], ['difficulty', f.difficulty],
    ['tag', f.tag && `#${f.tag}`], ['maxTime', f.maxTime && `≤ ${f.maxTime} min`],
  ];
  for (const [key, label] of pillDefs) if (label) pills.push(el('span', { class: 'pill' }, label, el('button', { onclick: () => { if (key === 'q') $('#searchInput').value = ''; setFilter(key, ''); } }, '×')));
  if (pills.length) { const pf = el('div', { class: 'active-filters' }, ...pills, el('button', { class: 'btn ghost small', onclick: clearFilters }, 'Clear all')); c.append(pf); }

  if (!state.recipes.length) {
    c.append(el('div', { class: 'empty' }, el('div', { class: 'big' }, '🍽️'), el('div', {}, 'No recipes match. Try adjusting filters or add a new recipe.')));
    return;
  }

  const grid = el('div', { class: 'grid' });
  for (const r of state.recipes) grid.append(recipeCard(r));
  c.append(grid);
}

function recipeCard(r) {
  const media = imgUrl(r.image_key)
    ? el('div', { class: 'card-img' }, el('img', { src: imgUrl(r.image_key), loading: 'lazy', alt: r.title }))
    : el('div', { class: 'card-img' }, el('div', { class: 'placeholder' }, '🍲'));
  const tags = el('div', { class: 'tag-row' }, ...(r.tags || []).slice(0, 3).map((t) => el('span', { class: 'tag' }, t)));
  return el('div', { class: 'card', onclick: () => go('/recipe/' + r.id) },
    media,
    el('div', { class: 'card-body' },
      el('div', { class: 'card-title' }, r.title),
      tags,
      el('div', { class: 'card-meta' },
        el('span', { class: 'card-book' }, el('span', { class: 'book-dot', style: `background:${esc(r.book_color || '#ccc')}` }), r.book_title || ''),
        el('span', {}, '⏱ ' + fmtTime(r.total_minutes)))));
}

async function clearFilters() {
  state.filters = { q: '', book: '', cuisine: '', category: '', difficulty: '', tag: '', maxTime: '' };
  $('#searchInput').value = '';
  await refreshList();
}

/* ------------------------------ detail ------------------------------ */

let detailState = null;

async function renderDetail(id) {
  const c = $('#content'); c.innerHTML = ''; c.append(el('div', { class: 'loading' }, 'Loading…'));
  let recipe;
  try { recipe = await api.get('/api/recipes/' + id); } catch (e) { c.innerHTML = ''; c.append(el('div', { class: 'empty' }, 'Recipe not found.')); return; }
  detailState = { recipe, servings: recipe.servings };
  paintDetail();
}

function paintDetail() {
  const { recipe } = detailState;
  const servings = detailState.servings;
  const factor = servings / (recipe.baseServings || 1);
  const c = $('#content'); c.innerHTML = '';

  const hero = imgUrl(recipe.image_key)
    ? el('div', { class: 'detail-hero' }, el('img', { src: imgUrl(recipe.image_key), alt: recipe.title }))
    : el('div', { class: 'detail-hero' }, el('div', { class: 'placeholder' }, '🍲'));

  const view = el('div', { class: 'detail' });
  view.append(el('button', { class: 'back', onclick: () => go('') }, '← Back to recipes'));
  view.append(hero);
  view.append(el('h1', {}, recipe.title));
  if (recipe.description) view.append(el('div', { class: 'desc' }, recipe.description));

  const book = state.books.find((b) => b.id === recipe.book_id);
  view.append(el('div', { class: 'meta-row' },
    el('span', {}, book ? ['📗 ', el('b', {}, book.title)] : ''),
    recipe.cuisine ? el('span', {}, ['🌍 ', el('b', {}, recipe.cuisine)]) : null,
    recipe.category ? el('span', {}, ['🍽 ', el('b', {}, recipe.category)]) : null,
    el('span', {}, ['⏱ Prep ', el('b', {}, fmtTime(recipe.prep_minutes)), ' · Cook ', el('b', {}, fmtTime(recipe.cook_minutes))]),
    el('span', {}, ['📊 ', el('b', {}, recipe.difficulty)])));

  view.append(el('div', { class: 'detail-actions' },
    el('button', { class: 'btn ghost small', onclick: () => openRecipeModal(recipe) }, '✎ Edit'),
    el('button', { class: 'btn danger small', onclick: () => deleteRecipe(recipe.id) }, 'Delete')));

  // columns
  const cols = el('div', { class: 'detail-cols' });

  // ingredients panel with serving control
  const ingPanel = el('div', { class: 'panel' });
  ingPanel.append(el('h3', {}, 'Ingredients'));
  const stepper = el('div', { class: 'stepper' },
    el('button', { onclick: () => changeServings(-1) }, '−'),
    el('input', { type: 'number', min: '1', value: String(servings), id: 'servInput', onchange: (e) => setServings(parseInt(e.target.value, 10)) }),
    el('button', { onclick: () => changeServings(1) }, '+'));
  ingPanel.append(el('div', { class: 'serving-ctl' }, el('span', { class: 'label' }, 'Servings'), stepper));
  ingPanel.append(el('div', { class: 'scale-note' }, Math.abs(factor - 1) > 0.001 ? `Scaled ${factor.toFixed(2)}× from ${recipe.baseServings} servings` : ''));

  const ul = el('ul', { class: 'ing-list' });
  for (const ing of recipe.ingredients) {
    const q = ing.quantity === null ? '' : prettyNum(ing.scalable ? ing.quantity * factor : ing.quantity);
    ul.append(el('li', {},
      el('span', { class: 'ing-qty' }, [q, ing.unit ? ' ' + ing.unit : ''].join('')),
      el('span', {}, ing.name)));
  }
  ingPanel.append(ul);
  cols.append(ingPanel);

  // steps
  const stepPanel = el('div', { class: 'panel' });
  stepPanel.append(el('h3', {}, 'Method'));
  const ol = el('ol', { class: 'step-list' });
  for (const s of recipe.steps) ol.append(el('li', {}, s.instruction));
  stepPanel.append(ol);
  if (recipe.tags?.length) stepPanel.append(el('div', { class: 'tag-row', style: 'margin-top:16px' }, ...recipe.tags.map((t) => el('span', { class: 'tag' }, '#' + t))));
  cols.append(stepPanel);

  view.append(cols);
  c.append(view);
}

function prettyNum(n) { const r = Math.round(n * 100) / 100; return Number.isInteger(r) ? String(r) : String(parseFloat(r.toFixed(2))); }
function changeServings(d) { setServings(detailState.servings + d); }
function setServings(v) { if (!Number.isFinite(v) || v < 1) v = 1; if (v > 999) v = 999; detailState.servings = v; paintDetail(); }

async function deleteRecipe(id) {
  if (!confirm('Delete this recipe? This cannot be undone.')) return;
  try { await api.del('/api/recipes/' + id); toast('Recipe deleted'); await loadMeta(); go(''); } catch (e) { toast('Delete failed: ' + e.message); }
}

/* ------------------------------ modals ------------------------------ */

function openModal(title, bodyNode, footNode) {
  const root = $('#modalRoot');
  root.innerHTML = '';
  const modal = el('div', { class: 'modal' },
    el('div', { class: 'modal-head' }, el('h2', {}, title), el('button', { class: 'x', onclick: closeModal }, '×')),
    el('div', { class: 'modal-body' }, bodyNode),
    footNode);
  root.append(el('div', { class: 'modal-backdrop', onclick: closeModal }), modal);
  root.classList.add('open'); root.setAttribute('aria-hidden', 'false');
}
function closeModal() { const root = $('#modalRoot'); root.classList.remove('open'); root.setAttribute('aria-hidden', 'true'); root.innerHTML = ''; }

/* ---- book modal ---- */
const BOOK_COLORS = ['#e07a5f', '#c9a227', '#3d7068', '#6d597a', '#b56576', '#457b9d'];

function openBookModal() {
  const body = el('div', {});
  const fTitle = inputField('Title', 'text', 'e.g. Sunday Baking');
  const fAuthor = inputField('Author (optional)', 'text', 'e.g. Grandma');
  const fDesc = textareaField('Description (optional)', 'What is this book about?');
  const colorWrap = el('div', { class: 'color-swatches' });
  BOOK_COLORS.forEach((col, i) => {
    const id = 'col' + i;
    colorWrap.append(el('label', { for: id },
      el('input', { type: 'radio', name: 'bookColor', id, value: col, ...(i === 0 ? { checked: 'checked' } : {}) }),
      el('span', { style: `background:${col}` })));
  });
  body.append(fTitle.wrap, fAuthor.wrap, fDesc.wrap, el('div', { class: 'field' }, el('label', {}, 'Cover color'), colorWrap));

  const foot = el('div', { class: 'modal-foot' },
    el('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'),
    el('button', { class: 'btn primary', onclick: async () => {
      if (!fTitle.input.value.trim()) { toast('Title is required'); return; }
      const color = $('input[name=bookColor]:checked', body)?.value || BOOK_COLORS[0];
      try {
        await api.post('/api/books', { title: fTitle.input.value, author: fAuthor.input.value, description: fDesc.input.value, color });
        toast('Book created'); closeModal(); await loadMeta(); renderSidebar(); await refreshList();
      } catch (e) { toast('Failed: ' + e.message); }
    } }, 'Create book'));
  openModal('New book', body, foot);
}

/* ---- recipe modal ---- */
function openRecipeModal(existing) {
  const r = existing || {};
  const body = el('div', {});
  let imageKey = r.image_key || null;

  const fTitle = inputField('Title', 'text', 'e.g. Lemon Risotto', r.title || '');
  const bookSel = el('select', {});
  for (const b of state.books) { const o = el('option', { value: b.id }, b.title); if (r.book_id === b.id) o.selected = true; bookSel.append(o); }
  const fBook = { wrap: fieldWrap('Book', bookSel), input: bookSel };
  const fDesc = textareaField('Description', 'A short description', r.description || '');

  const fServings = inputField('Base servings', 'number', '4', r.baseServings || r.servings || 4);
  const fPrep = inputField('Prep (min)', 'number', '10', r.prep_minutes ?? 0);
  const fCook = inputField('Cook (min)', 'number', '20', r.cook_minutes ?? 0);

  const diffSel = el('select', {});
  for (const d of ['easy', 'medium', 'hard']) { const o = el('option', { value: d }, d); if ((r.difficulty || 'easy') === d) o.selected = true; diffSel.append(o); }
  const fDiff = { input: diffSel };
  const fCuisine = inputField('Cuisine', 'text', 'e.g. Italian', r.cuisine || '');
  const fCategory = inputField('Category', 'text', 'e.g. Main', r.category || '');
  const fTags = inputField('Tags (comma separated)', 'text', 'quick, vegetarian', (r.tags || []).join(', '));

  // image uploader
  const preview = el('img', { class: 'img-preview', style: imageKey ? '' : 'display:none', ...(imageKey ? { src: imgUrl(imageKey) } : {}) });
  const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: async (e) => {
    const file = e.target.files[0]; if (!file) return;
    drop.textContent = 'Uploading…';
    try {
      const res = await fetch('/api/images', { method: 'POST', headers: { 'content-type': file.type }, body: file });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json(); imageKey = data.key;
      preview.src = imgUrl(imageKey); preview.style.display = ''; drop.textContent = '📷 Change photo';
    } catch (err) { toast('Image upload failed'); drop.textContent = '📷 Add a photo'; }
  } });
  const drop = el('div', { class: 'img-drop', onclick: () => fileInput.click() }, imageKey ? '📷 Change photo' : '📷 Add a photo (optional)');

  // ingredient rows
  const ingWrap = el('div', { class: 'row-editor' });
  const addIng = (ing = {}) => ingWrap.insertBefore(ingredientRow(ing), addIngBtn);
  const addIngBtn = el('button', { class: 'btn ghost small add-line', onclick: () => addIng({}) }, '+ Ingredient');
  ingWrap.append(addIngBtn);
  (r.ingredients && r.ingredients.length ? r.ingredients : [{}]).forEach((i) => addIng(i));

  // step rows
  const stepWrap = el('div', { class: 'row-editor' });
  const addStep = (s = '') => stepWrap.insertBefore(stepRow(s), addStepBtn);
  const addStepBtn = el('button', { class: 'btn ghost small add-line', onclick: () => addStep('') }, '+ Step');
  stepWrap.append(addStepBtn);
  (r.steps && r.steps.length ? r.steps.map((s) => s.instruction) : ['']).forEach((s) => addStep(s));

  body.append(
    fTitle.wrap, fBook.wrap, fDesc.wrap,
    el('div', { class: 'field-row-3' }, fServings.wrap, fPrep.wrap, fCook.wrap),
    el('div', { class: 'field-row-3' }, fieldWrap('Difficulty', diffSel), fCuisine.wrap, fCategory.wrap),
    el('div', { class: 'field' }, el('label', {}, 'Photo'), drop, preview, fileInput),
    el('div', { class: 'field' }, el('label', {}, 'Ingredients'), ingWrap),
    el('div', { class: 'field' }, el('label', {}, 'Method'), stepWrap),
    fTags.wrap,
  );

  const foot = el('div', { class: 'modal-foot' },
    el('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'),
    el('button', { class: 'btn primary', onclick: async () => {
      const payload = {
        title: fTitle.input.value, book_id: fBook.input.value, description: fDesc.input.value,
        image_key: imageKey, servings: parseInt(fServings.input.value, 10) || 4,
        prep_minutes: parseInt(fPrep.input.value, 10) || 0, cook_minutes: parseInt(fCook.input.value, 10) || 0,
        difficulty: fDiff.input.value, cuisine: fCuisine.input.value, category: fCategory.input.value,
        tags: fTags.input.value.split(',').map((s) => s.trim()).filter(Boolean),
        ingredients: [...ingWrap.querySelectorAll('.ing-row')].map((row) => ({
          quantity: row.querySelector('.i-qty').value, unit: row.querySelector('.i-unit').value,
          name: row.querySelector('.i-name').value, scalable: !row.querySelector('.i-fixed').checked,
        })).filter((i) => i.name.trim()),
        steps: [...stepWrap.querySelectorAll('.s-text')].map((t) => t.value).filter((s) => s.trim()),
      };
      if (!payload.title.trim()) { toast('Title is required'); return; }
      if (!payload.book_id) { toast('Pick a book (create one first)'); return; }
      try {
        if (existing) await api.put('/api/recipes/' + r.id, payload);
        else await api.post('/api/recipes', payload);
        toast(existing ? 'Recipe updated' : 'Recipe added'); closeModal();
        await loadMeta();
        if (existing) { await renderDetail(r.id); } else { go(''); await refreshList(); }
      } catch (e) { toast('Save failed: ' + e.message); }
    } }, existing ? 'Save changes' : 'Add recipe'));

  openModal(existing ? 'Edit recipe' : 'New recipe', body, foot);
}

function ingredientRow(ing) {
  const row = el('div', { class: 'ing-row' });
  row.append(
    el('input', { class: 'i-qty', type: 'text', placeholder: 'Qty', value: ing.quantity ?? '' }),
    el('input', { class: 'i-unit', type: 'text', placeholder: 'Unit', value: ing.unit ?? '' }),
    el('input', { class: 'i-name', type: 'text', placeholder: 'Ingredient', value: ing.name ?? '' }),
    el('button', { class: 'mini-x', title: 'Remove', onclick: () => row.remove() }, '×'));
  const fixedId = 'fx' + Math.random().toString(36).slice(2, 7);
  const fixed = el('input', { class: 'i-fixed', type: 'checkbox', id: fixedId, ...(ing.scalable === false ? { checked: 'checked' } : {}) });
  row.append(el('label', { for: fixedId, class: 'hint', style: 'grid-column:1 / -1; display:flex; gap:6px; align-items:center; margin-top:-2px' }, fixed, 'Fixed amount (does not scale with servings)'));
  return row;
}

function stepRow(text) {
  const row = el('div', { class: 'step-row' });
  row.append(
    el('textarea', { class: 's-text', rows: '2', placeholder: 'Describe this step…' }, text || ''),
    el('button', { class: 'mini-x', title: 'Remove', onclick: () => row.remove() }, '×'));
  return row;
}

/* ---- field helpers ---- */
function fieldWrap(label, inputNode) { return el('div', { class: 'field' }, el('label', {}, label), inputNode); }
function inputField(label, type, ph, value = '') { const input = el('input', { type, placeholder: ph, value: value }); return { wrap: fieldWrap(label, input), input }; }
function textareaField(label, ph, value = '') { const input = el('textarea', { placeholder: ph }, value); return { wrap: fieldWrap(label, input), input }; }

/* ------------------------------ search ------------------------------ */

let searchTimer;
function onSearch(e) {
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(async () => { state.filters.q = v; if (location.hash.startsWith('#/recipe/')) go(''); await refreshList(); }, 250);
}

/* ------------------------------- boot ------------------------------- */

async function boot() {
  $('#homeBtn').addEventListener('click', () => { go(''); });
  $('#addRecipeBtn').addEventListener('click', () => {
    if (!state.books.length) { toast('Create a book first'); openBookModal(); return; }
    openRecipeModal(null);
  });
  $('#addBookBtn').addEventListener('click', openBookModal);
  $('#searchInput').addEventListener('input', onSearch);
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  try { await loadMeta(); } catch (e) { $('#content').innerHTML = `<div class="empty">Could not reach the API. ${esc(e.message)}</div>`; return; }
  await route();
}

boot();
