// Минификация клиентского JS и CSS через esbuild.
// JS: каждый файл src/assets/js/**/*.js собирается отдельно, без склейки, как ES-модуль,
// поэтому import './cart.js' между модулями работает в браузере как есть.
// Собираются только существующие файлы: пока модуля нет, сборка не падает.
import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p, ext);
    return e.name.endsWith(ext) ? [p] : [];
  });
}

// Имена модулей верхнего уровня: { cart: true, forms: true, ... }.
export function listJsModules(inputDir) {
  const dir = path.join(inputDir, "assets", "js");
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(
    fs.readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => [f.slice(0, -3), true]),
  );
}

export async function buildAssets({ inputDir, outputDir }) {
  const js = walk(path.join(inputDir, "assets", "js"), ".js");
  const css = walk(path.join(inputDir, "assets", "css"), ".css");
  const common = { minify: true, bundle: false, write: true, logLevel: "warning", legalComments: "none" };
  if (js.length) {
    await esbuild.build({
      ...common,
      entryPoints: js,
      outbase: path.join(inputDir, "assets", "js"),
      outdir: path.join(outputDir, "assets", "js"),
      format: "esm",
      target: "es2020",
    });
  }
  if (css.length) {
    await esbuild.build({
      ...common,
      entryPoints: css,
      outbase: path.join(inputDir, "assets", "css"),
      outdir: path.join(outputDir, "assets", "css"),
      loader: { ".css": "css" },
    });
  }
}
