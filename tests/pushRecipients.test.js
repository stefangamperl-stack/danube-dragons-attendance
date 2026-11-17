import test from "node:test";
import assert from "node:assert/strict";
import { addDays, selectPushRecipients } from "../lib/pushRecipients.js";

test("addDays handles month boundaries", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
});

test("only active players without yes, no or an active limitation are selected", () => {
  const players = [
    { id: "open", active: true },
    { id: "maybe", active: true },
    { id: "yes", active: true },
    { id: "no", active: true },
    { id: "limited", active: true },
    { id: "inactive", active: false }
  ];
  const responses = [
    { player_id: "maybe", status: "maybe" },
    { player_id: "yes", status: "yes" },
    { player_id: "no", status: "no" }
  ];
  const limitations = [
    { player_id: "limited", valid_from: "2026-11-16", duration_days: 3 }
  ];

  const result = selectPushRecipients(players, responses, limitations, "2026-11-17");
  assert.deepEqual(result.map(player => player.id), ["open", "maybe"]);
});

test("expired and future limitations do not block a reminder", () => {
  const players = [
    { id: "expired", active: true },
    { id: "future", active: true }
  ];
  const limitations = [
    { player_id: "expired", valid_from: "2026-11-10", duration_days: 2 },
    { player_id: "future", valid_from: "2026-11-20", duration_days: 2 }
  ];

  const result = selectPushRecipients(players, [], limitations, "2026-11-17");
  assert.deepEqual(result.map(player => player.id), ["expired", "future"]);
});
