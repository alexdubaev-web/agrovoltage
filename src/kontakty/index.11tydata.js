import { regionsIn } from "../uslugi/region-text.js";

// Края — из settings.regions, чтобы правка «Настроек» в Sveltia меняла и эту страницу (R27.1).
export default {
  eleventyComputed: {
    regionText: (data) => regionsIn(data.settings?.regions),
    seo: (data) => ({
      title: "Телефон и заявка на ремонт электрики John Deere",
      description: `Телефон мастера, почта, MAX, адрес и часы работы. Ремонтируем электрику и кондиционеры техники John Deere ${regionsIn(data.settings?.regions)}.`,
    }),
  },
};
