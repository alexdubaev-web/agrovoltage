// Помощники для проверки собранного сайта.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { JSDOM } from "jsdom";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const DIST = path.join(ROOT, "dist");

export function walk(dir, filter = () => true) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p, filter);
    return filter(p) ? [p] : [];
  });
}

// HTML-страницы сайта (без админки Sveltia).
export function htmlPages(dist = DIST) {
  return walk(dist, (p) => p.endsWith(".html")).filter(
    (p) => !path.relative(dist, p).split(path.sep).includes("admin"),
  );
}

export function dom(file) {
  return new JSDOM(fs.readFileSync(file, "utf8")).window.document;
}

export function jsonLd(document) {
  return [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
    JSON.parse(s.textContent),
  );
}

// Все @type из JSON-LD страницы (включая @graph).
export function ldTypes(document) {
  const types = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node["@type"]) types.push(...[].concat(node["@type"]));
    if (node["@graph"]) visit(node["@graph"]);
  };
  jsonLd(document).forEach(visit);
  return types;
}

export function ldNode(document, type) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if ([].concat(node["@type"] || []).includes(type)) found.push(node);
    if (node["@graph"]) visit(node["@graph"]);
  };
  jsonLd(document).forEach(visit);
  return found[0];
}

export const gzipSize = (file) => zlib.gzipSync(fs.readFileSync(file)).length;

// Путь в dist/ для локального адреса или null, если файла нет.
export function resolveLocal(url, dist = DIST) {
  const clean = decodeURI(url.split("#")[0].split("?")[0]);
  if (!clean.startsWith("/")) return null;
  const candidates = clean.endsWith("/")
    ? [path.join(dist, clean, "index.html")]
    : [path.join(dist, clean), path.join(dist, clean, "index.html")];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}

// JS страницы: <script src> и всё, что они импортируют.
export function pageJs(document, dist = DIST) {
  const seen = new Set();
  const queue = [...document.querySelectorAll("script[src]")]
    .map((s) => s.getAttribute("src"))
    .filter((s) => s.startsWith("/"))
    .map((s) => resolveLocal(s, dist))
    .filter(Boolean);
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const code = fs.readFileSync(file, "utf8");
    for (const m of code.matchAll(/(?:import|from)\s*\(?\s*["']([^"']+\.js)["']/g)) {
      const target = m[1].startsWith("/") ? resolveLocal(m[1], dist) : path.resolve(path.dirname(file), m[1]);
      if (target && fs.existsSync(target)) queue.push(target);
    }
  }
  return [...seen];
}

export function pageCss(document, dist = DIST) {
  return [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map((l) => resolveLocal(l.getAttribute("href"), dist))
    .filter(Boolean);
}

// Локальные ссылки страницы, которые надо найти в dist/.
export function localRefs(document) {
  const refs = [];
  for (const [sel, attr] of [["a[href]", "href"], ["link[href]", "href"], ["script[src]", "src"], ["img[src]", "src"], ["source[srcset]", "srcset"], ["img[srcset]", "srcset"]]) {
    for (const el of document.querySelectorAll(sel)) {
      const value = el.getAttribute(attr);
      const urls = attr === "srcset" ? value.split(",").map((s) => s.trim().split(/\s+/)[0]) : [value];
      for (const u of urls) if (u && u.startsWith("/") && !u.startsWith("//") && !u.startsWith("/api/")) refs.push(u);
    }
  }
  return refs;
}
