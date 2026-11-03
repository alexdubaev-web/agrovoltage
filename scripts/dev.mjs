import fs from "node:fs";
// Локальная разработка: Eleventy пересобирает dist/ при изменениях,
// PHP-сервер отдаёт dist/ и выполняет dist/api/*.php на одном адресе.
import { spawn } from "node:child_process";
import path from "node:path";
import { validateContent } from "./validate-content.mjs";

// Переменные из .env (SITE_URL, INDEXABLE), если файл есть. Уже заданные в окружении не перезаписываются.
if (fs.existsSync(".env")) process.loadEnvFile(".env");

const HOST = process.env.DEV_HOST || "localhost";
const PORT = process.env.DEV_PORT || "8080";

const errors = validateContent();
if (errors.length) {
  console.error(`Ошибки в данных (${errors.length}):\n${errors.join("\n")}`);
  process.exit(1);
}

const eleventyBin = path.resolve("node_modules", "@11ty", "eleventy", "cmd.cjs");
const children = [
  spawn(process.execPath, [eleventyBin, "--watch"], { stdio: "inherit" }),
  spawn("php", ["-S", `${HOST}:${PORT}`, "-t", "dist", path.join("scripts", "dev-router.php")], { stdio: "inherit" }),
];
console.log(`Сайт: http://${HOST}:${PORT}/  (Sveltia: http://${HOST}:${PORT}/admin/)`);

const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const c of children) c.on("exit", (code) => { if (code) { console.error("Процесс завершился с ошибкой, останавливаю."); stop(); process.exit(code); } });
