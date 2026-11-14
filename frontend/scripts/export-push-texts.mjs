// Copiază textele notificărilor din traducerile aplicației în server (backend/src/main/resources/push-texts.json),
// ca alertele push să fie trimise în limba fiecărui utilizator. Rulează: npm run push-texts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '../src/app/core/i18n/');
const out = path.join(here, '../../backend/src/main/resources/push-texts.json');
const LANGS = ['ro', 'en', 'de', 'fr', 'es', 'it', 'hu', 'pl', 'uk', 'tr'];

const flat = (o, p = '', a = {}) => { for (const [k, v] of Object.entries(o)) (v && typeof v === 'object') ? flat(v, p + k + '.', a) : (a[p + k] = v); return a; };
const load = (f) => {
  if (!fs.existsSync(dir + f)) return {};
  const src = fs.readFileSync(dir + f, 'utf8').replace(/^\s*\/\/.*$/mg, '').replace(/^\/\*[\s\S]*?\*\//m, '').replace(/^import.*$/mg, '').replace('export default', 'return');
  return flat(new Function(src)());
};
const pick = (d, prefix) => Object.fromEntries(Object.entries(d).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]));

const result = {};
for (const l of LANGS) {
  const d = Object.assign({}, ...['', '2', '3', '4', '5'].map((n) => load(`${l}${n}.ts`)));
  result[l] = { notifications: pick(d, 'notifications.'), carriers: pick(d, 'orders.carriers.'), reasons: pick(d, 'report.reason.') };
  delete result[l].notifications.title; delete result[l].notifications.empty; delete result[l].notifications.markRead;
}
fs.writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
console.log('push-texts.json:', LANGS.map((l) => `${l}=${Object.keys(result[l].notifications).length}`).join(' '));
