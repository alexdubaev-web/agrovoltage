import { loadCollection } from "../lib/content.js";
import { faqLd, itemListLd } from "../lib/seo.js";

const home = () => loadCollection("pages").find((p) => p.slug === "home");

// «Рентген» трактора: база src/assets/images/xray/tractor-xray-base.png и поверх неё прозрачные слои
// tractor-xray-<system>-layer.png (см. layers ниже). Координаты — в процентах от картинки,
// точка неисправности — у узла своей системы.
const XRAY_DIR = "/assets/images/xray";
const XRAY_SYSTEMS = {
  start: { x: 31.6, y: 57.6, tone: "fault", alt: "подсвечена цепь пуска: аккумулятор и стартер" },
  charge: { x: 27.2, y: 50.8, tone: "fault", alt: "подсвечена цепь заряда: генератор и аккумулятор" },
  ecu: { x: 42.3, y: 43, tone: "fault", alt: "подсвечены блок управления двигателем и его датчики" },
  cab: { x: 51.4, y: 13.7, tone: "fault", alt: "подсвечены монитор, фары и проводка кабины" },
  harness: { x: 46.2, y: 54.2, tone: "fault", alt: "подсвечен главный жгут проводки" },
  climate: { x: 19.5, y: 45.9, tone: "frost", alt: "подсвечен контур кондиционера: компрессор и блок на крыше" },
};
// Подписи узлов: side — куда от узла вынесена подпись. Подпись — кнопка выбора причины своей system (история 20).
// service — своя услуга для ссылки без JS, если услуга симптома system к узлу не подходит.
const XRAY_NODES = [
  { label: "Кабина", x: 63.5, y: 27.3, system: "cab", side: "right" },
  { label: "ЭБУ", x: 42.3, y: 43, system: "ecu", side: "up" },
  { label: "Кондиционер", x: 19.5, y: 45.9, system: "climate", side: "up" },
  { label: "Генератор", x: 27.2, y: 50.8, system: "charge", side: "left" },
  { label: "Жгут", x: 46.2, y: 54.2, system: "harness", side: "right" },
  { label: "Стартер", x: 31.6, y: 57.6, system: "start", side: "down", service: "remont-generatorov-i-starterov" },
  { label: "АКБ", x: 54.7, y: 61, system: "start", side: "down" },
];

// Цена «от …» тем же видом, что фильтр price в eleventy.config.js.
const priceFrom = (v) =>
  typeof v === "number" ? `от ${v.toLocaleString("ru-RU").replace(/\s/g, " ")} ₽` : "";

// Группы услуг на главной (как в макете B): диагностика и выезд — в «Электрике».
const SERVICE_GROUPS = [
  { name: "Электрика", icon: "bolt", groups: ["diagnostics", "electrics", "field"] },
  // ­ — мягкий перенос: на десктопе название группы делится как в макете.
  { name: "Электро­оборудование", icon: "gear", groups: ["equipment"] },
  { name: "Климат", icon: "snowflake", groups: ["climate"] },
];

function symptoms(services) {
  const list = home()?.data.symptoms || [];
  return list
    .filter((s) => XRAY_SYSTEMS[s.system])
    .map((s) => {
      const svc = services.find((x) => x.slug === s.service);
      return {
        ...s,
        serviceTitle: svc?.data.title || "",
        serviceUrl: svc?.url || "/uslugi/",
        price: priceFrom(svc?.data.priceFrom),
      };
    });
}

// Запчасти в наличии: по одной из каждой категории (в порядке категорий), с фото и в наличии.
function homeProducts() {
  // Сначала позиции с ценой: в макете у запчастей цена, а не «по запросу».
  const all = loadCollection("products").filter((p) => p.data.inStock && p.data.images?.length);
  const products = [...all.filter((p) => typeof p.data.price === "number"), ...all.filter((p) => typeof p.data.price !== "number")];
  const picked = [];
  for (const cat of loadCollection("categories")) {
    const p = products.find((x) => x.data.category === cat.slug);
    if (p) picked.push(p);
  }
  for (const p of products) if (picked.length < 4 && !picked.includes(p)) picked.push(p);
  return picked.slice(0, 4);
}

export default {
  scripts: ["xray"],
  eleventyComputed: {
    title: () => home()?.data.title || "Главная",
    seo: () => home()?.data.seo || {},
    lastmod: () => home()?.date,
    heroSymptoms: () => symptoms(loadCollection("services")),
    xray: () => {
      const list = symptoms(loadCollection("services"));
      const active = list[0]?.system || "base";
      return {
        active,
        base: { src: `${XRAY_DIR}/tractor-xray-base.png`, alt: "Трактор в разрезе: проводка, генератор, стартер, блок управления и кондиционер" },
        // Слои подсветки — прозрачные PNG поверх базы, вырезаны scripts/make-xray-layers.py из tractor-xray-<system>.png.
        layers: Object.entries(XRAY_SYSTEMS).map(([system, v]) => ({
          system,
          ...v,
          src: `${XRAY_DIR}/tractor-xray-${system}-layer.png`,
        })),
        fault: XRAY_SYSTEMS[active] || null,
        nodes: XRAY_NODES.map((n) => {
          const s = list.find((x) => x.system === n.system);
          const own = n.service && loadCollection("services").find((x) => x.slug === n.service);
          return { ...n, symptom: s?.label || "", serviceUrl: own?.url || s?.serviceUrl || "" };
        }),
      };
    },
    serviceGroups: () => {
      const services = loadCollection("services");
      return SERVICE_GROUPS.map((g) => ({
        ...g,
        items: services
          .filter((s) => g.groups.includes(s.data.group))
          .map((s) => ({ url: s.url, title: s.data.title, summary: s.data.summary, image: s.data.image, price: priceFrom(s.data.priceFrom) })),
      })).filter((g) => g.items.length);
    },
    homeProducts: () => homeProducts(),
    jsonld: () =>
      [
        itemListLd(loadCollection("services").map((s) => ({ name: s.data.title, url: s.url }))),
        faqLd(home()?.data.faq),
      ].filter(Boolean),
  },
};
