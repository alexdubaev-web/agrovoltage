import { loadCollection } from "../lib/content.js";
import { faqLd, itemListLd } from "../lib/seo.js";

const home = () => loadCollection("pages").find((p) => p.slug === "home");

export default {
  eleventyComputed: {
    title: () => home()?.data.title || "Главная",
    seo: () => home()?.data.seo || {},
    lastmod: () => home()?.date,
    jsonld: () =>
      [
        itemListLd(loadCollection("services").map((s) => ({ name: s.data.title, url: s.url }))),
        faqLd(home()?.data.faq),
      ].filter(Boolean),
  },
};
