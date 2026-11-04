import { itemListLd } from "../../lib/seo.js";
import { urls } from "../../lib/urls.js";
import { regionsIn } from "../uslugi/region-text.js";

export default {
  eleventyComputed: {
    // Края — из settings.regions, чтобы правка «Настроек» меняла и эту страницу.
    seo: (data) => ({
      title: "Где работаем: ремонт электрики John Deere по краям",
      description: `Принимаем заявки на диагностику и ремонт электрики, электрооборудования и кондиционеров техники John Deere ${regionsIn(data.settings?.regions)}.`,
    }),
    breadcrumbs: () => [
      { name: "Главная", url: "/" },
      { name: "Регионы", url: urls.regions() },
    ],
    jsonld: (data) => [itemListLd((data.collections.regions || []).map((r) => ({ name: r.data.title, url: r.url })))].filter(Boolean),
  },
};
