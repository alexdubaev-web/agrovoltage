import { loadCollection } from "../../lib/content.js";
import { itemListLd } from "../../lib/seo.js";
import { regionsIn } from "./region-text.js";

const GROUPS = [
  { key: "diagnostics", name: "Диагностика" },
  { key: "electrics", name: "Электрика и проводка" },
  { key: "equipment", name: "Электрооборудование" },
  { key: "climate", name: "Кондиционеры" },
  { key: "field", name: "Выезд" },
];

export default {
  eleventyComputed: {
    // Регионы — из settings.regions (R27.1).
    regionText: (data) => regionsIn(data.settings?.regions),
    seo: (data) => ({
      title: "Услуги по диагностике и ремонту электрики John Deere",
      description: `Диагностика, ремонт электрики, проводки, электрооборудования и кондиционеров сельхозтехники John Deere ${regionsIn(data.settings?.regions)}.`,
    }),
    // Группы с услугами, в порядке из GROUPS; пустые группы не выводятся.
    serviceGroups: () => {
      const services = loadCollection("services");
      return GROUPS.map((g) => ({ ...g, items: services.filter((s) => s.data.group === g.key) })).filter((g) => g.items.length);
    },
    jsonld: () => [itemListLd(loadCollection("services").map((s) => ({ name: s.data.title, url: s.url })))].filter(Boolean),
  },
};
