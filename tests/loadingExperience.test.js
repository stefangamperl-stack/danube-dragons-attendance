import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
const loadingSource = readFileSync(new URL("../js/loading.js", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

test("a compact accessible loading screen is available", () => {
  assert.match(indexSource, /id="globalLoadingScreen"/);
  assert.match(indexSource, /role="status"/);
  assert.match(indexSource, /src="js\/loading\.js"/);
  assert.match(styleSource, /\.globalLoadingPanel/);
  assert.match(styleSource, /@keyframes salixLoadingProgress/);
});

test("slow user actions use the global loading state", () => {
  assert.match(loadingSource, /SHOW_DELAY_MS = 110/);
  assert.match(loadingSource, /setPlayerResponse: "Antwort wird gespeichert"/);
  assert.match(loadingSource, /setView: "Ansicht wird geladen"/);
  assert.match(loadingSource, /finally \{\s*hide\(\)/);
  assert.match(workerSource, /"\/js\/loading\.js"/);
});
