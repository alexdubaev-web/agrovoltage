// Конфигурация Eleventy 3. Границы: interfaces.md §3, §6.
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
  eleventyConfig.addPassthroughCopy({ [`${INPUT}/assets/images`]: "/assets/images" });

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
  eleventyConfig.addFilter("pageExists", (url, all) => (all || []).some((p) => p.url === url));
  eleventyConfig.addFilter("existingPages", (items, all) => (items || []).filter((i) => (all || []).some((p) => p.url === i.url)));
  // Картинки страницы для sitemap: sitemapImages[] и seo.ogImage, абсолютные, без повторов.
  eleventyConfig.addFilter("sitemapImages", (data) => [
    ...new Set([...(data?.sitemapImages || []), data?.seo?.ogImage].filter(Boolean).map((p) => absoluteUrl(p, site.url))),
  ]);

  // Данные.
  eleventyConfig.addFilter("findBySlug", (list, slug) => (list || []).find((i) => (i.slug ?? i.data?.slug) === slug));
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
