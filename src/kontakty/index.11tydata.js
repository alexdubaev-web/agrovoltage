import { regionsIn, regionsList } from "../uslugi/region-text.js";

// Регионы — из settings.regions, чтобы правка «Настроек» в Sveltia меняла и эту страницу (R27.1).
export default {
  eleventyComputed: {
    regionText: (data) => regionsIn(data.settings?.regions),
    seo: (data) => ({
      title: "Контакты",
      description: `Телефон, адрес, режим работы и регионы работы ${data.settings?.brand || ""}. ${regionsList(data.settings?.regions)}.`.replace(/\s+\./g, "."),
    }),
  },
};
