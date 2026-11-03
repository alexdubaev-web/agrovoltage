// Тестовая сборка: временный контент + виртуальные страницы на базовом layout.
// Так каркас проверяется до того, как появятся настоящие страницы и контент.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "./dist.mjs";

export function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `agv-${prefix}-`));
}

export function writeFiles(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return dir;
}

export const VALID_CONTENT = {
  "services/test-service.md": `---
title: Диагностика электрики
slug: test-service
group: diagnostics
summary: Проверка электрики трактора
priceFrom: 1500
image: /assets/brand/og-default.png
symptoms: [Не заводится]
diagnosticsSteps: [Осмотр]
works: [Ремонт]
stages: [Заявка]
faq:
  - q: Сколько длится диагностика?
    a: Тестовый ответ
prices:
  - group: Диагностика
    items:
      - name: Компьютерная диагностика
        price: null
order: 1
demo: true
seo:
  title: Диагностика электрики John Deere
  description: Тестовое описание услуги
---
Текст услуги.
`,
  "categories/test-category.json": JSON.stringify({ title: "Генераторы", slug: "test-category", description: "Тест", image: "", order: 1, seo: {} }),
  "products/test-product.md": `---
title: Генератор тестовый
slug: test-product
sku: RE-0001
category: test-category
price: null
inStock: true
compatibility: [John Deere 6155M]
images: []
summary: Тест
specs:
  - name: Напряжение
    value: 12 В
demo: true
seo: {}
---
Описание.
`,
  "articles/test-article.md": `---
title: Тестовая статья
slug: test-article
date: 2026-11-01
cover: ""
excerpt: Анонс
relatedServices: [test-service]
demo: true
seo: {}
---
Текст статьи.
`,
  "regions/test-region.md": `---
title: Ставропольский край
slug: test-region
lead: Тест
localities: [Ставрополь]
faq: []
seo: {}
---
`,
  "pages/home.md": `---
title: Главная
slug: home
hero:
  title: Ремонт электрики John Deere
  lead: Тест
  image: ""
advantages:
  - title: Тест
    text: Тест
steps: [Заявка]
faq: []
seo: {}
---
`,
};

// Запускает тестовую сборку в отдельном процессе. Возвращает результат spawnSync.
export function fixtureBuild({ outDir, contentDir, env = {} }) {
  const script = path.join(ROOT, "tests", "helpers", "fixture-build.mjs");
  return spawnSync(process.execPath, [script], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SITE_URL: "", INDEXABLE: "", ...env, OUTPUT_DIR: outDir, CONTENT_DIR: contentDir },
  });
}
