import test from "node:test";
import assert from "node:assert/strict";
import { createDocumentsHandler } from "../api/documents.js";
import { DOCUMENT_BUCKET, MAX_DOCUMENT_FILE_SIZE } from "../lib/documentStore.js";

class FakeStorage {
  constructor() {
    this.bucket = null;
    this.objects = new Map();
    this.downloadCalls = [];
  }

  async getBucket(name) {
    if (!this.bucket || this.bucket.name !== name) {
      return { data: null, error: { message: "Bucket not found", statusCode: "404" } };
    }
    return { data: this.bucket, error: null };
  }

  async createBucket(name, options) {
    this.bucket = { name, ...options };
    return { data: this.bucket, error: null };
  }

  async updateBucket(name, options) {
    this.bucket = { name, ...(this.bucket || {}), ...options };
    return { data: this.bucket, error: null };
  }

  putFile(path, body, contentType = "application/pdf") {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    this.objects.set(path, {
      body: buffer,
      metadata: { size: buffer.length, mimetype: contentType }
    });
  }

  from(bucketName) {
    assert.equal(bucketName, DOCUMENT_BUCKET);
    return {
      download: async (path, options, parameters) => {
        this.downloadCalls.push({ path, options, parameters });
        const object = this.objects.get(path);
        if (!object) {
          return { data: null, error: { message: "Object not found", statusCode: "404" } };
        }
        return { data: new Blob([object.body]), error: null };
      },
      upload: async (path, body, options = {}) => {
        this.putFile(path, body, options.contentType || "application/octet-stream");
        return { data: { path }, error: null };
      },
      remove: async paths => {
        paths.forEach(path => this.objects.delete(path));
        return { data: paths, error: null };
      },
      list: async (prefix, options = {}) => {
        const normalizedPrefix = `${String(prefix || "").replace(/\/$/, "")}/`;
        const data = [...this.objects.entries()]
          .filter(([path]) => path.startsWith(normalizedPrefix))
          .map(([path, object]) => ({
            name: path.slice(normalizedPrefix.length),
            metadata: object.metadata
          }))
          .filter(item => !item.name.includes("/"))
          .filter(item => !options.search || item.name.includes(options.search));
        return { data, error: null };
      },
      createSignedUploadUrl: async path => ({
        data: { path, token: `token-for-${path}`, signedUrl: `https://upload.invalid/${path}` },
        error: null
      }),
      createSignedUrl: async (path, expiresIn) => ({
        data: { signedUrl: `https://download.invalid/${path}?expires=${expiresIn}` },
        error: null
      })
    };
  }
}

function createFakeAdmin() {
  const storage = new FakeStorage();
  const players = [
    { id: "player-1", profile_id: "profile-player-1", unit: "QB", active: true },
    { id: "player-2", profile_id: "profile-player-2", unit: "RB", active: true }
  ];

  return {
    storage,
    from(table) {
      assert.equal(table, "players");
      const filters = [];
      return {
        select() { return this; },
        eq(column, value) { filters.push([column, value]); return this; },
        async single() {
          const data = players.find(player => filters.every(([column, value]) => player[column] === value));
          return data ? { data, error: null } : { data: null, error: { message: "Not found" } };
        }
      };
    }
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function createApiHarness() {
  const adminClient = createFakeAdmin();
  const authorize = async req => ({
    user: { id: req.testUserId || "coach-user" },
    profile: {
      id: req.testProfileId || "coach-profile",
      role: req.testRole || "adminCoach"
    }
  });
  const handler = createDocumentsHandler({
    adminClient,
    authorize,
    verifyPdf: async () => {}
  });

  async function call({ method = "GET", body = {}, query = {}, role, profileId, userId } = {}) {
    const req = {
      method,
      body,
      query,
      testRole: role,
      testProfileId: profileId,
      testUserId: userId
    };
    const res = createResponse();
    await handler(req, res);
    return res;
  }

  return { adminClient, call };
}

test("the complete document manager lifecycle works with uncached metadata", async () => {
  const { adminClient, call } = createApiHarness();

  let response = await call();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.folders, []);
  assert.equal(adminClient.storage.bucket.public, false);

  response = await call({
    method: "POST",
    body: { action: "create-folder", name: "Defense", parentId: "", units: ["DL", "LB", "DB"] }
  });
  assert.equal(response.statusCode, 200);
  const defenseId = response.body.folder.id;

  response = await call();
  assert.equal(response.body.folders.length, 1, "an empty folder must remain visible after creation");

  response = await call({
    method: "POST",
    body: { action: "create-folder", name: "Linebacker", parentId: defenseId, units: ["LB"] }
  });
  assert.equal(response.statusCode, 200);
  const linebackerId = response.body.folder.id;

  response = await call({
    method: "POST",
    body: { action: "create-folder", name: "Offense", parentId: "", units: ["QB", "RB"] }
  });
  assert.equal(response.statusCode, 200);
  const offenseId = response.body.folder.id;

  response = await call({
    method: "POST",
    body: { action: "move-folder", folderId: offenseId, direction: "up" }
  });
  assert.equal(response.statusCode, 200);
  response = await call();
  assert.equal(response.body.folders.filter(folder => !folder.parentId)[0].id, offenseId);

  response = await call({
    method: "POST",
    body: { action: "update-folder", folderId: defenseId, name: "Defense Playbooks", parentId: "", units: ["DL", "LB", "DB"] }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.folder.name, "Defense Playbooks");

  response = await call({
    method: "POST",
    body: { action: "set-secondary-unit", playerId: "player-1", unit: "LB" }
  });
  assert.equal(response.statusCode, 200);

  response = await call({ role: "player", profileId: "profile-player-1", userId: "player-user-1" });
  assert.deepEqual(response.body.units, ["QB", "LB"]);
  assert.equal(response.body.folders.some(folder => folder.id === linebackerId), true);

  response = await call({
    method: "POST",
    body: { action: "prepare-upload", folderId: linebackerId, name: "Reads.pdf", size: 12, units: ["LB"] }
  });
  assert.equal(response.statusCode, 200);
  const upload = response.body;
  adminClient.storage.putFile(upload.path, "%PDF-test-content");

  response = await call({
    method: "POST",
    body: {
      action: "finalize-upload",
      folderId: linebackerId,
      fileId: upload.fileId,
      path: upload.path,
      name: upload.name,
      units: upload.units
    }
  });
  assert.equal(response.statusCode, 200);
  const fileId = response.body.file.id;

  response = await call({ role: "player", profileId: "profile-player-1", userId: "player-user-1" });
  assert.equal(response.body.files.some(file => file.id === fileId), true);

  response = await call({
    query: { action: "download", fileId },
    role: "player",
    profileId: "profile-player-2",
    userId: "player-user-2"
  });
  assert.equal(response.statusCode, 403);

  response = await call({
    query: { action: "download", fileId },
    role: "player",
    profileId: "profile-player-1",
    userId: "player-user-1"
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.body.signedUrl, /expires=90/);

  response = await call({
    method: "POST",
    body: { action: "update-file", fileId, name: "Updated Reads", units: ["LB"] }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.file.name, "Updated Reads.pdf");

  response = await call({
    method: "POST",
    body: { action: "delete-folder", folderId: defenseId }
  });
  assert.equal(response.statusCode, 400, "a folder with children must not be deleted");

  response = await call({ method: "POST", body: { action: "delete-file", fileId } });
  assert.equal(response.statusCode, 200);
  assert.equal(adminClient.storage.objects.has(upload.path), false);

  response = await call({ method: "POST", body: { action: "delete-folder", folderId: linebackerId } });
  assert.equal(response.statusCode, 200);
  response = await call({ method: "POST", body: { action: "delete-folder", folderId: defenseId } });
  assert.equal(response.statusCode, 200);
  response = await call({ method: "POST", body: { action: "delete-folder", folderId: offenseId } });
  assert.equal(response.statusCode, 200);

  response = await call();
  assert.deepEqual(response.body.folders, []);
  assert.deepEqual(response.body.files, []);

  const metadataReads = adminClient.storage.downloadCalls.filter(call => call.path.startsWith("_meta/"));
  assert.ok(metadataReads.length > 0);
  metadataReads.forEach(call => {
    assert.equal(call.parameters?.cache, "no-store");
    assert.ok(call.options?.cacheNonce);
  });
});

test("invalid and oversized uploads are rejected", async () => {
  const { call } = createApiHarness();
  let response = await call({
    method: "POST",
    body: { action: "create-folder", name: "QB", units: ["QB"] }
  });
  const folderId = response.body.folder.id;

  response = await call({
    method: "POST",
    body: { action: "prepare-upload", folderId, name: "Video.mp4", size: 100, units: ["QB"] }
  });
  assert.equal(response.statusCode, 400);

  response = await call({
    method: "POST",
    body: { action: "prepare-upload", folderId, name: "Huge.pdf", size: MAX_DOCUMENT_FILE_SIZE + 1, units: ["QB"] }
  });
  assert.equal(response.statusCode, 400);

  response = await call({
    method: "POST",
    body: { action: "prepare-upload", folderId, name: "Wrong unit.pdf", size: 100, units: ["DB"] }
  });
  assert.equal(response.statusCode, 400);
});
