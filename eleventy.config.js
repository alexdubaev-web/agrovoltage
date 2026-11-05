// Конфигурация Eleventy 3. Границы: interfaces.md §3, §6.
import fs from "node:fs";
import path from "node:path";
import { getSite } from "./lib/site.js";
import { COLLECTIONS, loadCollection, renderMarkdown } from "./lib/content.js";
import { urls, absoluteUrl } from "./lib/urls.js";
import * as seo from "./lib/seo.js";
import { createImageShortcode } from "./lib/images.js";
import { buildAssets, listJsModules } from "./lib/assets.js";

const INPUT = "src";
// Модули, которые подключаются на каждой странице (если файл существует).
const GLOBAL_SCRIPTS = ["consent", "forms", "cart"];

export default function (eleventyConfig) {
  const outputDir = process.env.OUTPUT_DIR || "dist";
  const site = getSite();

  eleventyConfig.addGlobalData("site", site);
  eleventyConfig.addGlobalData("jsModules", () => listJsModules(INPUT));
  eleventyConfig.addGlobalData("buildDate", () => new Date());
  // Главное меню (не больше 7 пунктов). Пункт показывается, только когда страница собрана.
  eleventyConfig.addGlobalData("navItems", [
    { name: "Услуги", url: "/uslugi/" },
    { name: "Каталог", url: "/katalog/" },
    { name: "Статьи", url: "/stati/" },
    { name: "Доставка", url: "/dostavka/" },
    { name: "О компании", url: "/o-kompanii/" },
    { name: "Контакты", url: "/kontakty/" },
  ]);

  // Контент читается своим загрузчиком, а не как шаблоны.
  eleventyConfig.ignores.add(`${INPUT}/content/**`);
  eleventyConfig.ignores.add(`${INPUT}/admin/**`);
  eleventyConfig.addWatchTarget(`${INPUT}/content/`);
  eleventyConfig.addWatchTarget(`${INPUT}/assets/js/`);
  eleventyConfig.addWatchTarget(`${INPUT}/assets/css/`);
  eleventyConfig.addWatchTarget("public/");
  eleventyConfig.setWatchJavaScriptDependencies(false);

  for (const name of Object.keys(COLLECTIONS)) {
    eleventyConfig.addCollection(name, () => loadCollection(name));
  }

  // Статика: public/ (api, .htaccess) — в корень сайта.
  eleventyConfig.addPassthroughCopy({ public: "/" });
  eleventyConfig.addPassthroughCopy({ [`${INPUT}/admin`]: "/admin" });
  eleventyConfig.addPassthroughCopy({ [`${INPUT}/assets/fonts/*.woff2`]: "/assets/fonts" });
  eleventyConfig.addPassthroughCopy({ [`${INPUT}/assets/brand`]: "/assets/brand" });
  eleventyConfig.addPassthroughCopy({ [`${INPUT}/assets/brand/favicon.ico`]: "/favicon.ico" });
  eleventyConfig.addPassthroughCopy({ [`${INPUT}/assets/uploads`]: "/assets/uploads" });
  // Картинки контента идут в dist/ как есть: на них ссылаются JSON-LD, og:image и поиск по каталогу.
  // Исходники рентгена (xray/, ~17 МБ PNG) страница берёт только через {% image %} — их не копируем.
  for (const dir of fs.readdirSync(path.join(INPUT, "assets/images"), { withFileTypes: true })) {
    if (dir.isDirectory() && dir.name !== "xray") {
      eleventyConfig.addPassthroughCopy({ [`${INPUT}/assets/images/${dir.name}`]: `/assets/images/${dir.name}` });
    }
  }

  eleventyConfig.on("eleventy.after", async () => {
    await buildAssets({ inputDir: INPUT, outputDir });
  });

  // Картинки.
  eleventyConfig.addAsyncShortcode("image", createImageShortcode({ inputDir: INPUT, outputDir }));

  // JSON-LD: функции lib/seo.js доступны и как фильтры.
  eleventyConfig.addFilter("jsonld", seo.jsonldScript);
  eleventyConfig.addFilter("organizationLd", (settings) => seo.organizationLd(settings, site.url));
  eleventyConfig.addFilter("serviceLd", (item, settings) => seo.serviceLd(item, settings, site.url));
  eleventyConfig.addFilter("productLd", (item, settings) => seo.productLd(item, settings, site.url));
  eleventyConfig.addFilter("articleLd", (item, settings) => seo.articleLd(item, settings, site.url));
  eleventyConfig.addFilter("breadcrumbLd", (items) => seo.breadcrumbLd(items, site.url));
  eleventyConfig.addFilter("faqLd", (faq) => seo.faqLd(faq));
  eleventyConfig.addFilter("itemListLd", (items) => seo.itemListLd(items, site.url));

  // Адреса.
  eleventyConfig.addFilter("absUrl", (p) => absoluteUrl(p, site.url));
  eleventyConfig.addFilter("serviceUrl", (slug) => urls.service(slug));
  eleventyConfig.addFilter("categoryUrl", (slug) => urls.category(slug));
  eleventyConfig.addFilter("productUrl", (slug, category) => urls.product(slug, category));
  eleventyConfig.addFilter("articleUrl", (slug) => urls.article(slug));
  eleventyConfig.addFilter("regionUrl", (slug) => urls.region(slug));
  eleventyConfig.addFilter("pageUrl", (slug) => urls.page(slug));
  // Есть ли собранная страница с таким адресом (ссылки меню не ведут в 404).
  // Карта адресов строится до рендера, поэтому видит и страницы-пагинации по коллекциям
  // (collections.all на момент рендера layout бывает неполной). Второй аргумент оставлен для совместимости.
  let knownUrls = new Set();
  eleventyConfig.on("eleventy.contentMap", ({ urlToInputPath }) => {
    knownUrls = new Set(Object.keys(urlToInputPath || {}));
  });
  const exists = (url, all) => knownUrls.has(url) || (all || []).some((p) => p.url === url);
  eleventyConfig.addFilter("pageExists", (url, all) => exists(url, all));
  eleventyConfig.addFilter("existingPages", (items, all) => (items || []).filter((i) => exists(i.url, all)));
  // Картинки страницы для sitemap: sitemapImages[] и seo.ogImage, абсолютные, без повторов.
  eleventyConfig.addFilter("sitemapImages", (data) => [
    ...new Set([...(data?.sitemapImages || []), data?.seo?.ogImage].filter(Boolean).map((p) => absoluteUrl(p, site.url))),
  ]);

  // Данные.
  eleventyConfig.addFilter("findBySlug", (list, slug) => (list || []).find((i) => (i.slug ?? i.data?.slug) === slug));
  eleventyConfig.addFilter("findByTitle", (list, title) => (list || []).find((i) => (i.data?.title ?? i.title) === title));
  eleventyConfig.addFilter("md", (text) => renderMarkdown(text));
  eleventyConfig.addFilter("isPlaceholder", (v) => typeof v === "string" && /^\s*\[.*\]\s*$/.test(v));
  eleventyConfig.addFilter("price", (value) =>
    typeof value === "number" ? `${value.toLocaleString("ru-RU").replace(/ /g, " ")} ₽` : "по запросу",
  );
  eleventyConfig.addFilter("dateRu", (value) => {
    const d = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  });
  eleventyConfig.addFilter("isoDate", (value) => {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  });
  // Список модулей для страницы: общие + scripts из данных страницы, только существующие.
  eleventyConfig.addFilter("pageScripts", (pageScripts, available) =>
    [...new Set([...GLOBAL_SCRIPTS, ...(pageScripts || [])])].filter((s) => available?.[s]),
  );

  return {
    dir: { input: INPUT, output: outputDir, includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
