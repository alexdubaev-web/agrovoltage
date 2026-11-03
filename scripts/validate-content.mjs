// Проверка контента против схем schemas/*.schema.json до рендера (interfaces.md §1).
// Ошибки — по-русски: «<файл>: поле <поле> — <что не так>». Код выхода 1 при ошибках.
// CONTENT_DIR подменяет src/content (для тестов).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { COLLECTIONS, contentDir, listFiles, parseFile } from "../lib/content.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_DIR = path.join(ROOT, "schemas");
const SCHEMA_OF = { services: "service", categories: "category", products: "product", articles: "article", regions: "region", pages: "page" };

const TYPE_RU = { string: "строка", number: "число", integer: "целое число", boolean: "да/нет", array: "список", object: "группа полей", null: "пусто" };

function fieldName(instancePath, extra) {
  const parts = instancePath.split("/").filter(Boolean).map((p) => (/^\d+$/.test(p) ? `[${p}]` : `.${p}`));
  if (extra) parts.push(`.${extra}`);
  return parts.join("").replace(/^\./, "") || "(весь файл)";
}

function describe(err) {
  const p = err.params || {};
  const hint = err.parentSchema?.description ? ` (${err.parentSchema.description})` : "";
  switch (err.keyword) {
    case "required": return [fieldName(err.instancePath, p.missingProperty), "обязательное поле не заполнено"];
    case "type": return [fieldName(err.instancePath), `ожидается ${[].concat(p.type).map((t) => TYPE_RU[t] || t).join(" или ")}`];
    case "pattern": return [fieldName(err.instancePath), `неверный формат${hint}`];
    case "enum": return [fieldName(err.instancePath), `допустимые значения: ${p.allowedValues.join(", ")}`];
    case "const": return [fieldName(err.instancePath), `должно быть «${p.allowedValue}»`];
    case "minLength": return [fieldName(err.instancePath), "не может быть пустым"];
    case "minItems": return [fieldName(err.instancePath), `нужно не меньше ${p.limit} элементов`];
    case "minimum": return [fieldName(err.instancePath), `не меньше ${p.limit}`];
    default: return [fieldName(err.instancePath), err.message];
  }
}

function makeAjv() {
  const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
  for (const f of fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".schema.json"))) {
    ajv.addSchema(JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, f), "utf8")));
  }
  return ajv;
}

// Возвращает массив строк-ошибок.
export function validateContent({ dir = contentDir(), dataDir = path.join(ROOT, "src", "_data") } = {}) {
  const ajv = makeAjv();
  const errors = [];
  const rel = (file) => path.relative(process.cwd(), file);
  const report = (file, field, text) => errors.push(`${rel(file)}: поле ${field} — ${text}`);

  const check = (file, schemaId, data) => {
    const validate = ajv.getSchema(schemaId);
    if (!validate(data)) {
      const seen = new Set();
      for (const e of validate.errors) {
        const [field, text] = describe(e);
        const key = `${field}|${text}`;
        if (!seen.has(key)) { seen.add(key); report(file, field, text); }
      }
    }
  };

  const loaded = {};
  for (const type of Object.keys(COLLECTIONS)) {
    loaded[type] = [];
    for (const file of listFiles(type, dir)) {
      let data;
      try {
        data = parseFile(file).data;
      } catch (e) {
        report(file, "(весь файл)", `не читается: ${e.message.split("\n")[0]}`);
        continue;
      }
      const name = path.basename(file).replace(/\.(md|json)$/, "");
      const schemaId = type === "pages" && name === "home" ? "page-home" : SCHEMA_OF[type];
      check(file, schemaId, data);
      if (data.slug && data.slug !== name) report(file, "slug", `не совпадает с именем файла «${name}»`);
      loaded[type].push({ file, data });
    }
  }

  // Связи между коллекциями.
  const categories = new Set(loaded.categories.map((c) => c.data.slug));
  const services = new Set(loaded.services.map((s) => s.data.slug));
  for (const { file, data } of loaded.products) {
    if (data.category && !categories.has(data.category)) report(file, "category", `категории «${data.category}» нет в src/content/categories`);
  }
  for (const { file, data } of loaded.articles) {
    for (const s of data.relatedServices || []) if (!services.has(s)) report(file, "relatedServices", `услуги «${s}» нет в src/content/services`);
  }

  // Файлы данных.
  for (const [name, schemaId] of [["settings.json", "settings"], ["models.json", "models"]]) {
    const file = path.join(dataDir, name);
    if (!fs.existsSync(file)) {
      if (name === "settings.json") report(file, "(весь файл)", "файл настроек не найден");
      continue;
    }
    try {
      check(file, schemaId, JSON.parse(fs.readFileSync(file, "utf8")));
    } catch (e) {
      report(file, "(весь файл)", `не читается: ${e.message.split("\n")[0]}`);
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validateContent();
  if (errors.length) {
    console.error(`Ошибки в данных (${errors.length}):\n${errors.join("\n")}`);
    process.exit(1);
  }
  console.log("Данные в порядке.");
}
