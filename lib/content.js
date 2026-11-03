// Чтение коллекций контента из src/content/ (interfaces.md §1).
// Файлы контента не являются шаблонами Eleventy: их читает этот модуль, а страницы
// строят шаблоны через pagination по collections.<имя>.
// Папку можно подменить переменной CONTENT_DIR (так тесты проверяют пустые коллекции).
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import yaml from "js-yaml";
import MarkdownIt from "markdown-it";
import { contentUrl } from "./urls.js";

export const COLLECTIONS = {
  services: "md",
  categories: "json",
  products: "md",
  articles: "md",
  regions: "md",
  pages: "md",
};

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

export function contentDir(env = process.env) {
  return path.resolve(env.CONTENT_DIR || "src/content");
}

const pad = (n) => String(n).padStart(2, "0");
export function isoDate(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// YAML превращает 2026-11-03 в Date; в данных храним строку, как пишет Sveltia.
function normalize(value) {
  if (value instanceof Date) return isoDate(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}

export function parseFile(file) {
  const raw = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) return { data: normalize(JSON.parse(raw)), body: "" };
  const parsed = matter(raw, {
    engines: { yaml: (s) => yaml.load(s, { schema: yaml.DEFAULT_SCHEMA }) || {} },
  });
  return { data: normalize(parsed.data || {}), body: parsed.content || "" };
}

export function listFiles(type, dir = contentDir()) {
  const folder = path.join(dir, type);
  if (!fs.existsSync(folder)) return [];
  const ext = `.${COLLECTIONS[type]}`;
  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(ext) && !f.startsWith("."))
    .sort()
    .map((f) => path.join(folder, f));
}

const byOrder = (a, b) =>
  (a.data.order ?? 1e9) - (b.data.order ?? 1e9) || String(a.data.title).localeCompare(String(b.data.title), "ru");
const byTitle = (a, b) => String(a.data.title).localeCompare(String(b.data.title), "ru");
const byDateDesc = (a, b) => String(b.data.date).localeCompare(String(a.data.date)) || byTitle(a, b);
const SORT = { services: byOrder, categories: byOrder, products: byTitle, articles: byDateDesc, regions: byTitle, pages: byTitle };

// Элемент коллекции: { slug, url, inputPath, date, data, body, content }.
// data — front matter (или JSON), body — Markdown, content — готовый HTML.
export function loadCollection(type, dir = contentDir()) {
  return listFiles(type, dir)
    .map((file) => {
      const { data, body } = parseFile(file);
      const slug = data.slug || path.basename(file).replace(/\.(md|json)$/, "");
      const full = { ...data, slug };
      const date = data.date ? new Date(`${data.date}T00:00:00Z`) : fs.statSync(file).mtime;
      return {
        slug,
        url: contentUrl(type, full),
        inputPath: file,
        date,
        data: full,
        body,
        content: body ? md.render(body) : "",
      };
    })
    .sort(SORT[type]);
}

export function renderMarkdown(text) {
  return text ? md.render(String(text)) : "";
}
