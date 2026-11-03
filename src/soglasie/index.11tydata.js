import { loadCollection } from "../../lib/content.js";

const doc = () => loadCollection("pages").find((p) => p.slug === "consent");

export default {
  eleventyComputed: {
    title: () => doc()?.data.title,
    seo: () => doc()?.data.seo || {},
    lastmod: () => doc()?.date,
    breadcrumbs: () => [{ name: "Главная", url: "/" }, { name: doc()?.data.title }],
  },
};
