// HTTP-контракт /api/*.php (interfaces.md §5) через встроенный сервер PHP.
// Внешней сети нет: каналы либо не настроены («только журнал»), либо смотрят
// на локальные заглушки SMTP и Bot API MAX, поднятые в этом же процессе.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { spawn, spawnSync, execFile } from "node:child_process";
import { promisify } from "node:util";

// Асинхронно: заглушки SMTP и MAX живут в этом же процессе и должны отвечать во время работы PHP.
const runPhp = (args, env) => promisify(execFile)("php", args, { env, encoding: "utf8" }).then((r) => ({ status: 0, ...r }), (e) => ({ status: e.code ?? 1, stdout: e.stdout, stderr: e.stderr }));

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const CHANNEL_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_SECURE", "MAIL_FROM", "MAIL_TO", "MAX_BOT_TOKEN", "MAX_CHAT_ID", "MAX_API_URL"];
const ID_RE = /^AGV-\d{8}-\d{4}$/;
const FAKE_MAX_TOKEN = "test-max-token-not-a-secret";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

// Окружение без значений из настоящего .env: AGV_ENV_FILE указывает на несуществующий файл,
// все переменные каналов явно пустые, хранилище — временная папка.
function testEnv(storage, extra = {}) {
  const env = { ...process.env, AGV_STORAGE_DIR: storage, AGV_ENV_FILE: path.join(storage, "no.env") };
  for (const k of CHANNEL_VARS) env[k] = "";
  return { ...env, ...extra };
}

async function startPhp(extraEnv = {}) {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), "agv-api-"));
  const port = await freePort();
  const env = testEnv(storage, extraEnv);
  const proc = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", path.join(ROOT, "public")], { env, stdio: "ignore" });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { await fetch(`${base}/api/token.php`); break; } catch { await sleep(50); }
  }
  return {
    base, storage, env,
    stop: () => { proc.kill(); },
    journal: () => readJsonl(path.join(storage, "leads.jsonl")),
    appLog: () => (fs.existsSync(path.join(storage, "app.log")) ? fs.readFileSync(path.join(storage, "app.log"), "utf8") : ""),
  };
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Сессия браузера: cookie + токен из /api/token.php.
async function session(base) {
  const res = await fetch(`${base}/api/token.php`);
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  const body = await res.json();
  return { cookie, token: body.token };
}

function validLead(type = "callback", extra = {}) {
  const lead = {
    type, name: "Иван", phone: "+7 (962) 001-19-90", message: "Не работает кондиционер",
    page: "/", consent: true, consentVersion: "1", website: "", startedAt: Date.now() - 10_000,
  };
  if (type === "service") lead.service = "Ремонт кондиционера";
  if (type === "order") lead.items = [{ slug: "rele", title: "Реле", price: 1500, qty: 2 }, { slug: "datchik", title: "Датчик", price: null, qty: 1 }];
  return { ...lead, ...extra };
}

async function post(base, s, body, { token = s?.token, cookie = s?.cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-CSRF-Token"] = token;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${base}/api/lead.php`, { method: "POST", headers, body: JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { /* не JSON */ }
  return { status: res.status, json };
}

const leadsOf = (journal) => journal.filter((r) => r.kind === "lead");
const deliveryOf = (journal, id) => journal.filter((r) => r.kind === "delivery" && r.id === id).at(-1);

describe("токен и CSRF", () => {
  let srv;
  before(async () => { srv = await startPhp(); });
  after(() => srv.stop());

  test("GET /api/token.php выдаёт токен", async () => {
    const s = await session(srv.base);
    assert.match(s.token, /^[a-f0-9]{32,}$/);
    assert.ok(s.cookie, "сессионная cookie");
  });

  test("POST без токена → 403, с чужим токеном → 403, в журнал не пишется", async () => {
    const a = await session(srv.base);
    const b = await session(srv.base);
    assert.equal((await post(srv.base, a, validLead(), { token: null })).status, 403);
    assert.equal((await post(srv.base, a, validLead(), { token: b.token })).status, 403);
    assert.equal((await post(srv.base, null, validLead(), { token: a.token, cookie: null })).status, 403);
    assert.equal(leadsOf(srv.journal()).length, 0);
  });
});

describe("приём заявок в режиме «только журнал»", () => {
  let srv;
  before(async () => { srv = await startPhp(); });
  after(() => srv.stop());

  test("три типа заявок → 200 с номером AGV-YYYYMMDD-NNNN и запись в журнале", async () => {
    const s = await session(srv.base);
    const ids = [];
    for (const type of ["callback", "service", "order"]) {
      const r = await post(srv.base, s, validLead(type));
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.ok, true);
      assert.match(r.json.id, ID_RE);
      ids.push(r.json.id);
    }
    assert.equal(new Set(ids).size, 3, "номера уникальны");
    const leads = leadsOf(srv.journal());
    assert.deepEqual(leads.map((l) => l.id), ids);
    assert.deepEqual(leads.map((l) => l.type), ["callback", "service", "order"]);
    assert.equal(leads[1].service, "Ремонт кондиционера");
    assert.deepEqual(leads[2].items.map((i) => [i.slug, i.qty, i.price]), [["rele", 2, 1500], ["datchik", 1, null]]);
    assert.equal(leads[0].consentVersion, "1");
  });

  test("без ключей каналы пропускаются, это видно в storage/app.log, статус — только журнал", async () => {
    const id = leadsOf(srv.journal())[0].id;
    const d = deliveryOf(srv.journal(), id);
    assert.deepEqual(d.channels, { mail: "skipped", max: "skipped" });
    const log = srv.appLog();
    assert.match(log, /только журнал/i);
    assert.match(log, /SMTP_HOST/);
    assert.match(log, /MAX_BOT_TOKEN/);
  });

  test("невалидные данные → 422 с русским текстом у поля, без записи", async () => {
    const s = await session(srv.base);
    const before = leadsOf(srv.journal()).length;
    let r = await post(srv.base, s, validLead("callback", { phone: "12345" }));
    assert.equal(r.status, 422);
    assert.equal(r.json.ok, false);
    assert.match(r.json.errors.phone, /[а-я]/i);
    r = await post(srv.base, s, validLead("callback", { name: "   " }));
    assert.equal(r.status, 422);
    assert.match(r.json.errors.name, /[а-я]/i);
    r = await post(srv.base, s, validLead("callback", { consent: false }));
    assert.equal(r.status, 422);
    assert.match(r.json.errors.consent, /[а-я]/i);
    r = await post(srv.base, s, validLead("order", { items: [] }));
    assert.equal(r.status, 422);
    assert.ok(r.json.errors.items);
    r = await post(srv.base, s, validLead("callback", { type: "spam" }));
    assert.equal(r.status, 422);
    assert.equal(leadsOf(srv.journal()).length, before);
  });

  test("ловушка или заполнение быстрее 3 с → тихий отказ без записи", async () => {
    const s = await session(srv.base);
    const before = leadsOf(srv.journal()).length;
    let r = await post(srv.base, s, validLead("callback", { website: "http://spam" }));
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    r = await post(srv.base, s, validLead("callback", { startedAt: Date.now() - 500 }));
    assert.equal(r.status, 200);
    r = await post(srv.base, s, validLead("callback", { startedAt: undefined }));
    assert.equal(r.status, 200);
    assert.equal(leadsOf(srv.journal()).length, before);
  });
});

describe("ограничение частоты", () => {
  let srv;
  before(async () => { srv = await startPhp(); });
  after(() => srv.stop());

  test("шестая заявка с одного IP за 15 минут → 429", async () => {
    const s = await session(srv.base);
    for (let i = 0; i < 5; i++) assert.equal((await post(srv.base, s, validLead())).status, 200, `заявка ${i + 1}`);
    const r = await post(srv.base, s, validLead());
    assert.equal(r.status, 429);
    assert.equal(r.json.ok, false);
    assert.match(r.json.error, /[а-я]/i);
    assert.equal(leadsOf(srv.journal()).length, 5);
  });
});

// Заглушка Bot API MAX: запоминает запросы, отвечает кодом из mode.
function startMaxStub() {
  const stub = { requests: [], status: 200 };
  stub.server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      stub.requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
      res.writeHead(stub.status, { "Content-Type": "application/json" });
      res.end(stub.status === 200 ? JSON.stringify({ message: { body: { mid: "m1", text: "ok" } } }) : JSON.stringify({ code: "internal", message: "fail" }));
    });
  });
  return new Promise((r) => stub.server.listen(0, "127.0.0.1", () => { stub.url = `http://127.0.0.1:${stub.server.address().port}`; r(stub); }));
}

// Минимальный SMTP-сервер без шифрования и авторизации: принимает письма в messages.
function startSmtpStub() {
  const stub = { messages: [] };
  stub.server = net.createServer((sock) => {
    let buf = ""; let data = false; let msg = "";
    sock.write("220 stub ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) {
          if (line === ".") { data = false; stub.messages.push(msg); msg = ""; sock.write("250 OK queued\r\n"); }
          else msg += line + "\n";
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") sock.write("250 stub\r\n");
        else if (cmd === "DATA") { data = true; sock.write("354 go\r\n"); }
        else if (cmd === "QUIT") { sock.write("221 bye\r\n"); sock.end(); }
        else sock.write("250 OK\r\n");
      }
    });
    sock.on("error", () => {});
  });
  return new Promise((r) => stub.server.listen(0, "127.0.0.1", () => { stub.port = stub.server.address().port; r(stub); }));
}

describe("каналы почты и MAX", () => {
  let srv, max, smtp, deadPort;
  before(async () => {
    max = await startMaxStub();
    smtp = await startSmtpStub();
    deadPort = await freePort(); // на этом порту никто не слушает: SMTP недоступен
    srv = await startPhp({
      SMTP_HOST: "127.0.0.1", SMTP_PORT: String(deadPort), MAIL_FROM: "site@example.test", MAIL_TO: "owner@example.test",
      MAX_BOT_TOKEN: FAKE_MAX_TOKEN, MAX_CHAT_ID: "-100500", MAX_API_URL: max.url,
    });
  });
  after(() => { srv.stop(); max.server.close(); smtp.server.close(); });

  test("MAX получает сообщение по формату Bot API: POST /messages?chat_id, токен в Authorization, text", async () => {
    const s = await session(srv.base);
    const r = await post(srv.base, s, validLead("order"));
    assert.equal(r.status, 200);
    const req = max.requests.at(-1);
    assert.equal(req.method, "POST");
    const url = new URL(req.url, max.url);
    assert.equal(url.pathname, "/messages");
    assert.equal(url.searchParams.get("chat_id"), "-100500");
    assert.equal(url.searchParams.get("access_token"), null, "токен не в адресе");
    assert.equal(req.auth, FAKE_MAX_TOKEN);
    const body = JSON.parse(req.body);
    assert.ok(body.text.includes(r.json.id));
    assert.ok(body.text.includes("Реле"));
    assert.ok(body.text.includes("+7 (962) 001-19-90"));
  });

  test("сбой почты не мешает MAX и не теряет заявку; секреты не попадают в лог", async () => {
    const s = await session(srv.base);
    const r = await post(srv.base, s, validLead("callback"));
    assert.equal(r.status, 200);
    const j = srv.journal();
    assert.ok(leadsOf(j).some((l) => l.id === r.json.id));
    assert.deepEqual(deliveryOf(j, r.json.id).channels, { mail: "failed", max: "sent" });
    assert.ok(!srv.appLog().includes(FAKE_MAX_TOKEN), "токен MAX не в логе");
    assert.ok(!fs.readFileSync(path.join(srv.storage, "leads.jsonl"), "utf8").includes(FAKE_MAX_TOKEN));
  });

  test("сбой MAX не мешает почте", async () => {
    // Сервер с рабочим SMTP-заглушкой и падающим MAX.
    const ok = await startPhp({
      SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.port), MAIL_FROM: "site@example.test", MAIL_TO: "owner@example.test",
      MAX_BOT_TOKEN: FAKE_MAX_TOKEN, MAX_CHAT_ID: "-100500", MAX_API_URL: max.url,
    });
    try {
      max.status = 500;
      const s = await session(ok.base);
      const r = await post(ok.base, s, validLead("service"));
      assert.equal(r.status, 200);
      assert.deepEqual(deliveryOf(ok.journal(), r.json.id).channels, { mail: "sent", max: "failed" });
      const mail = smtp.messages.at(-1);
      assert.ok(mail.includes(r.json.id), "номер заявки в письме");
      assert.ok(!mail.includes(FAKE_MAX_TOKEN));
    } finally { max.status = 200; ok.stop(); }
  });

  test("php backend/console.php resend доотправляет только недоставленные каналы", async () => {
    // Заявки из прошлого теста этого сервера: почта failed, MAX sent. Теперь SMTP работает.
    const failed = leadsOf(srv.journal()).filter((l) => deliveryOf(srv.journal(), l.id).channels.mail === "failed").map((l) => l.id);
    assert.ok(failed.length >= 1);
    const maxBefore = max.requests.length;
    const mailBefore = smtp.messages.length;
    const env = { ...srv.env, SMTP_PORT: String(smtp.port) };
    const res = await runPhp([path.join(ROOT, "backend", "console.php"), "resend"], env);
    assert.equal(res.status, 0, res.stderr + res.stdout);
    assert.equal(smtp.messages.length - mailBefore, failed.length, "по письму на каждую недоставленную");
    assert.equal(max.requests.length, maxBefore, "MAX повторно не отправляется");
    for (const id of failed) assert.deepEqual(deliveryOf(srv.journal(), id).channels, { mail: "sent", max: "sent" });
    // Повторный запуск ничего не отправляет.
    await runPhp([path.join(ROOT, "backend", "console.php"), "resend"], env);
    assert.equal(smtp.messages.length - mailBefore, failed.length);
  });
});

describe("закрытость backend/ и storage/", () => {
  test("в dist/ нет backend/ и storage/, есть api/*.php", (t) => {
    if (!fs.existsSync(DIST)) return t.skip("нет dist/: запускайте через npm test");
    assert.ok(!fs.existsSync(path.join(DIST, "backend")));
    assert.ok(!fs.existsSync(path.join(DIST, "storage")));
    assert.ok(fs.existsSync(path.join(DIST, "api", "lead.php")));
    assert.ok(fs.existsSync(path.join(DIST, "api", "token.php")));
  });

  test(".htaccess запрещает доступ к backend/ и storage/", () => {
    for (const dir of ["backend", "storage"]) {
      const f = path.join(ROOT, dir, ".htaccess");
      assert.ok(fs.existsSync(f), f);
      assert.match(fs.readFileSync(f, "utf8"), /Require all denied/);
    }
  });

  test("в репозитории нет .env и значений секретов в .env.example", () => {
    const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
    for (const k of ["SMTP_HOST", "SMTP_PASSWORD", "MAIL_TO", "MAX_BOT_TOKEN", "MAX_CHAT_ID"]) {
      assert.match(example, new RegExp(`^${k}=$`, "m"), `${k} пустой`);
    }
    const tracked = spawnSync("git", ["ls-files", ".env", "storage"], { cwd: ROOT, encoding: "utf8" }).stdout.trim().split("\n").filter(Boolean);
    assert.ok(!tracked.includes(".env"));
    assert.ok(tracked.every((f) => /storage\/\.(gitkeep|htaccess)$/.test(f)), tracked.join(","));
  });
});
