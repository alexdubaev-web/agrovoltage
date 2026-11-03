// Регионы работы в предложном падеже для заголовков и описаний: берутся из settings.regions,
// поэтому после правки «Настроек» в Sveltia тексты страниц меняются сами (R27.1).
// «Ставропольский край», «Краснодарский край» → «в Ставропольском и Краснодарском крае».

const NOUNS = { край: "крае", область: "области", округ: "округе", республика: "республике" };
const ADJECTIVE = [
  [/(ск|цк)ий$/, "$1ом"],
  [/ый$/, "ом"],
  [/ий$/, "ем"],
  [/ой$/, "ом"],
  [/ая$/, "ой"],
  [/яя$/, "ей"],
  [/ое$/, "ом"],
];

// «Ставропольский край» → { adj: "Ставропольском", noun: "крае" }; null, если форма не распознана.
function parse(name) {
  const m = String(name).trim().match(/^(\S+)\s+(\S+)$/);
  if (!m) return null;
  const noun = NOUNS[m[2].toLowerCase()];
  const rule = ADJECTIVE.find(([re]) => re.test(m[1]));
  return noun && rule ? { adj: m[1].replace(rule[0], rule[1]), noun } : null;
}

const joinRu = (parts) => (parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} и ${parts.at(-1)}`);

/** ["Ставропольский край", "Краснодарский край"] → «в Ставропольском и Краснодарском крае». */
export function regionsIn(regions = []) {
  const list = (Array.isArray(regions) ? regions : []).filter(Boolean);
  if (!list.length) return "";
  const parsed = list.map(parse);
  if (parsed.some((p) => !p)) return `в регионах: ${list.join(", ")}`;
  if (parsed.every((p) => p.noun === parsed[0].noun)) return `в ${joinRu(parsed.map((p) => p.adj))} ${parsed[0].noun}`;
  return `в ${joinRu(parsed.map((p) => `${p.adj} ${p.noun}`))}`;
}

/** ["Ставропольский край", "Краснодарский край"] → «Ставропольский край, Краснодарский край». */
export const regionsList = (regions = []) => (Array.isArray(regions) ? regions : []).filter(Boolean).join(", ");
