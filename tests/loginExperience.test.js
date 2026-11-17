import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const pwaSource = readFileSync(new URL("../js/pwa.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

test("login screen uses the premium responsive layout", () => {
  assert.match(indexSource, /class="loginShell"/);
  assert.match(indexSource, /class="loginBrandPanel"/);
  assert.match(indexSource, /class="loginFormCard"/);
  assert.match(indexSource, /autocomplete="username"/);
  assert.match(indexSource, /autocomplete="current-password"/);
  assert.match(styleSource, /\.loginShell/);
  assert.match(styleSource, /@media \(max-width: 520px\)/);
});

test("mobile install link opens the device-specific installation flow", () => {
  assert.match(indexSource, /href="\/\?install=1"/);
  assert.match(pwaSource, /URLSearchParams\(window\.location\.search\)/);
  assert.match(pwaSource, /openInstallLink/);
  assert.match(pwaSource, /Auf iPhone oder iPad/);
  assert.match(pwaSource, /Installationsanleitung anzeigen/);
});

test("new login assets are delivered through a fresh app cache", () => {
  assert.match(workerSource, /CACHE_NAME = "salix-v16"/);
  assert.match(workerSource, /"\/css\/styles\.css"/);
  assert.match(workerSource, /"\/js\/pwa\.js"/);
});
