import { loadCollection } from "../../lib/content.js";
import { itemListLd } from "../../lib/seo.js";

// Группы как на главной (макет B): диагностика и выезд — в «Электрике».
// Края здесь не называются (история 17): они есть в JSON-LD и на /regiony/.
const GROUPS = [
  { key: "electrics", name: "Электрика", icon: "bolt", groups: ["diagnostics", "electrics", "field"] },
  { key: "equipment", name: "Электрооборудование", icon: "gear", groups: ["equipment"] },
  { key: "climate", name: "Климат", icon: "snowflake", groups: ["climate"] },
];

export default {
  eleventyComputed: {
    seo: () => ({
      title: "Ремонт и диагностика электрики John Deere: цены",
      description:
        "Диагностика электрики, ремонт проводки, генераторов, стартеров, оборудования кабины и кондиционеров John Deere. Цена «от» у каждой работы, запись по телефону.",
    }),
    // Группы с услугами, в порядке GROUPS; пустые группы не выводятся.
    serviceGroups: () => {
      const services = loadCollection("services");
      return GROUPS.map((g) => ({ ...g, items: services.filter((s) => g.groups.includes(s.data.group)) })).filter((g) => g.items.length);
    },
    jsonld: () => [itemListLd(loadCollection("services").map((s) => ({ name: s.data.title, url: s.url })))].filter(Boolean),
  },
};
