// Verificación estática: imports, exports y referencias cruzadas del proyecto.
const results = { files: 0, errors: [], warnings: [], exports: {}, imports: {} };

for (const path of ctx.files) {
  const name = path.replace(/^scratch\/src\//, '');
  if (!name.endsWith('.js')) continue;
  const src = ctx.readText(path);
  results.files++;

  const exps = new Set();
  for (const m of src.matchAll(/export\s+(?:class|const|function|let)\s+(\w+)/g)) exps.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(',').forEach((s) => {
      const n = s.trim().split(/\s+as\s+/).pop().trim();
      if (n) exps.add(n);
    });
  }
  if (/export\s+default/.test(src)) exps.add('__default__');
  results.exports[name] = [...exps];

  const deps = [];
  for (const m of src.matchAll(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const raw = m[1].trim();
    const names = [];
    const brace = raw.match(/\{([^}]*)\}/);
    if (brace) {
      brace[1].split(',').forEach((s) => {
        const n = s.trim().split(/\s+as\s+/)[0].trim();
        if (n) names.push(n);
      });
    }
    if (/^\w+$/.test(raw)) names.push('default');
    deps.push({ names, target: m[2] });
  }
  results.imports[name] = deps;
}

const allFiles = new Set(ctx.files.map((p) => p.replace(/^scratch\/src\//, '')));

function resolve(from, target) {
  const base = from.split('/').slice(0, -1);
  for (const p of target.split('/')) {
    if (p === '.' || p === '') continue;
    if (p === '..') base.pop();
    else base.push(p);
  }
  return base.join('/');
}

for (const [from, deps] of Object.entries(results.imports)) {
  for (const d of deps) {
    const to = resolve(from, d.target);
    if (!allFiles.has(to)) { results.warnings.push(from + ' -> ' + to); continue; }
    const have = results.exports[to] || [];
    for (const n of d.names) {
      if (n === 'default') { if (!have.includes('__default__')) results.errors.push('SIN DEFAULT: ' + to); continue; }
      if (!have.includes(n)) results.errors.push(from + ' pide {' + n + '} a ' + to);
    }
  }
}
return { checked: results.files, errors: results.errors, unverified: results.warnings.length };
