// Сборка: проверка данных → очистка выходной папки → Eleventy.
// При ошибке в данных выходная папка не создаётся и не меняется.
import fs from "node:fs";
import path from "node:path";
import Eleventy from "@11ty/eleventy";
import { validateContent } from "./validate-content.mjs";

// Переменные из .env (SITE_URL, INDEXABLE), если файл есть. Уже заданные в окружении не перезаписываются.
if (fs.existsSync(".env")) process.loadEnvFile(".env");

const errors = validateContent();
if (errors.length) {
  console.error(`Сборка остановлена, ошибки в данных (${errors.length}):\n${errors.join("\n")}`);
  process.exit(1);
}

const output = path.resolve(process.env.OUTPUT_DIR || "dist");
fs.rmSync(output, { recursive: true, force: true });
const elev = new Eleventy("src", output, { configPath: "eleventy.config.js" });
await elev.write();
