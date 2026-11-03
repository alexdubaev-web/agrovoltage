// Тестовая сборка (запускается из fixture.mjs в отдельном процессе).
// Окружение: OUTPUT_DIR, CONTENT_DIR, SITE_URL, INDEXABLE.
import Eleventy from "@11ty/eleventy";
import { validateContent } from "../../scripts/validate-content.mjs";
import { serviceLd, faqLd } from "../../lib/seo.js";
import fs from "node:fs";

const settings = JSON.parse(fs.readFileSync("src/_data/settings.json", "utf8"));
const errors = validateContent();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const elev = new Eleventy("src", process.env.OUTPUT_DIR, {
  configPath: "eleventy.config.js",
  quietMode: true,
  config(cfg) {
    cfg.addTemplate(
      "index.njk",
      "<h1>Главная</h1>{% set leadForm = {type: 'callback', id: 'home'} %}{% include 'partials/lead-form.njk' %}",
      { layout: "layouts/base.njk", title: "Главная", seo: { title: "Ремонт электрики John Deere", description: "Тестовая главная" } },
    );
    cfg.addTemplate(
      "fixture-service.njk",
      "<h1>{{ service.data.title }}</h1>{% set leadForm = {type: 'service', service: service.data.title, id: 'svc'} %}{% include 'partials/lead-form.njk' %}",
      {
        layout: "layouts/base.njk",
        pagination: { data: "collections.services", size: 1, alias: "service" },
        permalink: (data) => data.service.url,
        eleventyComputed: {
          title: (data) => data.service.data.title,
          seo: (data) => ({ ...data.service.data.seo, ogImage: data.service.data.image }),
          lastmod: (data) => data.service.date,
          sitemapImages: (data) => [data.service.data.image],
          breadcrumbs: (data) => [{ name: "Главная", url: "/" }, { name: data.service.data.title, url: data.service.url }],
          jsonld: (data) => [serviceLd(data.service, settings), faqLd(data.service.data.faq)],
        },
      },
    );
    cfg.addTemplate("soglasie.njk", "<h1>Согласие</h1>", { layout: "layouts/base.njk", title: "Согласие", permalink: "/soglasie/" });
  },
});
await elev.write();
