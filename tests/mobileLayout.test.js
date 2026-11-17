import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renderSource = readFileSync(new URL("../js/render.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");

test("every table has a mobile card layout or a dedicated mobile replacement", () => {
  const wrappers = [...renderSource.matchAll(/<div class="tableWrap ([^"]+)"/g)]
    .map(match => match[1]);

  assert.ok(wrappers.length >= 6);
  wrappers.forEach(classes => {
    assert.match(classes, /(mobileStackTable|reportsDesktopTable)/);
  });
});

test("mobile management views prioritize lists until an item is edited", () => {
  assert.match(renderSource, /playerManagementLayout/);
  assert.match(renderSource, /coachManagementLayout/);
  assert.match(renderSource, /limitationsLayout/);
  assert.match(styleSource, /\.playerManagementLayout \.managementListCard/);
  assert.match(styleSource, /\.playerManagementLayout\.isEditing \.managementFormColumn/);
});

test("mobile navigation exposes and follows the active view", () => {
  assert.match(renderSource, /aria-current="page"/);
  assert.match(renderSource, /scrollIntoView/);
  assert.match(styleSource, /\.nav button\.active/);
});
