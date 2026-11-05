// Шорткод {% image src, alt, sizes, eager %} → <picture> с AVIF и WebP (interfaces.md §3).
// src — публичный путь вида /assets/uploads/x.jpg; файл ищется в src/.
// eager: true — грузить сразу с fetchpriority="high"; "eager" — сразу, без повышенного приоритета.
import fs from "node:fs";
import path from "node:path";
import Image from "@11ty/eleventy-img";

const WIDTHS = [360, 720, 1080, 1600];
const escapeAttr = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function createImageShortcode({ inputDir, outputDir }) {
  return async function image(src, alt = "", sizes = "100vw", eager = false) {
    if (!src) return "";
    if (/^https?:\/\//.test(src)) {
      return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async">`;
    }
    const file = path.join(inputDir, String(src).replace(/^\/+/, ""));
    if (!fs.existsSync(file)) {
      console.warn(`[image] файл не найден: ${src}`);
      return `<span class="img-missing" role="img" aria-label="${escapeAttr(alt)}"></span>`;
    }
    const isSvg = file.endsWith(".svg");
    const metadata = await Image(file, {
      widths: isSvg ? ["auto"] : [...WIDTHS, "auto"],
      formats: isSvg ? ["svg"] : ["avif", "webp"],
      outputDir: path.join(outputDir, "assets", "img"),
      urlPath: "/assets/img/",
      svgShortCircuit: true,
      filenameFormat: (id, srcPath, width, format) =>
        `${path.basename(srcPath, path.extname(srcPath))}-${id}-${width}.${format}`,
    });
    return Image.generateHTML(metadata, {
      alt,
      sizes,
      loading: eager ? "eager" : "lazy",
      decoding: "async",
      ...(eager === true ? { fetchpriority: "high" } : {}),
    });
  };
}
