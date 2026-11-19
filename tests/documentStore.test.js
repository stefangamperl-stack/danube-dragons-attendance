import test from "node:test";
import assert from "node:assert/strict";
import {
  documentUnitsAllow,
  documentUnitsAreSubset,
  getFolderDescendantIds,
  normalizeDocumentUnits
} from "../lib/documentStore.js";

test("document units are normalized to the supported position list", () => {
  assert.deepEqual(normalizeDocumentUnits([" qb ", "QB", "rb", "invalid"]), ["QB", "RB"]);
});

test("primary or secondary unit can grant document access", () => {
  assert.equal(documentUnitsAllow(["DL", "LB"], ["QB", "LB"]), true);
  assert.equal(documentUnitsAllow(["DL", "LB"], ["QB", "WR"]), false);
});

test("file and child folder permissions must stay within the parent", () => {
  assert.equal(documentUnitsAreSubset(["QB", "RB"], ["QB", "RB", "WR"]), true);
  assert.equal(documentUnitsAreSubset(["QB", "DL"], ["QB", "RB", "WR"]), false);
  assert.equal(documentUnitsAreSubset([], ["QB"]), false);
});

test("nested folder descendants are detected", () => {
  const folders = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "c", parentId: "b" },
    { id: "d", parentId: null }
  ];
  assert.deepEqual([...getFolderDescendantIds(folders, "a")].sort(), ["b", "c"]);
});
