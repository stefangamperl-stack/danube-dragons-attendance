import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("documents are available to coaches and players through their own navigation view", async () => {
  const [renderSource, authSource, indexSource, workerSource] = await Promise.all([
    read("js/render.js"),
    read("js/auth.js"),
    read("index.html"),
    read("service-worker.js")
  ]);

  assert.match(renderSource, /key: "documents", label: "Dokumente"/);
  assert.match(renderSource, /renderDocumentsView\(\)/);
  assert.match(authSource, /view === "documents"/);
  assert.match(indexSource, /js\/documents\.js/);
  assert.match(workerSource, /"\/js\/documents\.js"/);
});

test("the second player unit is explicitly limited to document permissions", async () => {
  const [renderSource, actionsSource, dataSource] = await Promise.all([
    read("js/render.js"),
    read("js/actions.js"),
    read("js/data.js")
  ]);

  assert.match(renderSource, /2\. Unit nur für Dokumente/);
  assert.match(renderSource, /zählt nicht zur Unit-Anwesenheit/);
  assert.match(actionsSource, /savePlayerDocumentUnit/);
  assert.match(dataSource, /secondaryUnit: ""/);
});

test("document storage stays private and downloads use short lived signed links", async () => {
  const [apiSource, storeSource] = await Promise.all([
    read("api/documents.js"),
    read("lib/documentStore.js")
  ]);

  assert.match(storeSource, /public: false/);
  assert.match(storeSource, /MAX_DOCUMENT_FILE_SIZE/);
  assert.match(apiSource, /requireRole/);
  assert.match(apiSource, /createSignedUrl\(file\.storagePath, 90\)/);
  assert.match(apiSource, /createSignedUploadUrl/);
  assert.match(apiSource, /bytes !== "%PDF-"/);
});
