import { randomUUID } from "node:crypto";

export const DOCUMENT_BUCKET = "salix-documents";
export const DOCUMENT_UNITS = ["K", "QB", "OL", "RB", "WR", "TE", "DL", "LB", "DB"];
export const MAX_DOCUMENT_FILE_SIZE = 25 * 1024 * 1024;

const FOLDERS_PATH = "_meta/folders.json";
const FILES_PATH = "_meta/files.json";
const PLAYER_UNITS_PATH = "_meta/player-units.json";

export function getDocumentStorageLimitBytes() {
  const configured = Number(process.env.SALIX_DOCUMENT_STORAGE_LIMIT_BYTES || 0);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : 1024 * 1024 * 1024;
}

export function normalizeDocumentUnits(value) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.map(unit => String(unit || "").trim().toUpperCase()))]
    .filter(unit => DOCUMENT_UNITS.includes(unit));
}

export function documentUnitsAllow(allowedUnits, playerUnits) {
  const allowed = normalizeDocumentUnits(allowedUnits);
  const player = normalizeDocumentUnits(playerUnits);
  return player.some(unit => allowed.includes(unit));
}

export function documentUnitsAreSubset(childUnits, parentUnits) {
  const child = normalizeDocumentUnits(childUnits);
  const parent = new Set(normalizeDocumentUnits(parentUnits));
  return child.length > 0 && child.every(unit => parent.has(unit));
}

export function cleanDocumentName(value, fallback = "") {
  return String(value || fallback)
    .replace(/[<>\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function createDocumentId(prefix) {
  return `${prefix}_${randomUUID()}`;
}

function isMissingObjectError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("not found") || message.includes("does not exist") || error?.statusCode === "404";
}

export async function ensureDocumentBucket(supabaseAdmin) {
  const { data, error } = await supabaseAdmin.storage.getBucket(DOCUMENT_BUCKET);
  if (data && !error) {
    if (data.public === true) {
      const { data: updated, error: updateError } = await supabaseAdmin.storage.updateBucket(
        DOCUMENT_BUCKET,
        {
          public: false,
          fileSizeLimit: MAX_DOCUMENT_FILE_SIZE,
          allowedMimeTypes: ["application/pdf", "application/json"]
        }
      );
      if (updateError) throw updateError;
      return updated;
    }
    return data;
  }

  const { data: created, error: createError } = await supabaseAdmin.storage.createBucket(
    DOCUMENT_BUCKET,
    {
      public: false,
      fileSizeLimit: MAX_DOCUMENT_FILE_SIZE,
      allowedMimeTypes: ["application/pdf", "application/json"]
    }
  );

  if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
    throw createError;
  }

  return created;
}

async function readJsonObject(supabaseAdmin, path, fallback) {
  const { data, error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).download(path);
  if (error) {
    if (isMissingObjectError(error)) return structuredClone(fallback);
    throw error;
  }

  try {
    const parsed = JSON.parse(await data.text());
    return parsed ?? structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

async function writeJsonObject(supabaseAdmin, path, value) {
  const body = Buffer.from(JSON.stringify(value, null, 2), "utf8");
  const { error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).upload(path, body, {
    contentType: "application/json",
    cacheControl: "0",
    upsert: true
  });
  if (error) throw error;
}

export async function loadDocumentMetadata(supabaseAdmin) {
  await ensureDocumentBucket(supabaseAdmin);
  const [folders, files, playerUnits] = await Promise.all([
    readJsonObject(supabaseAdmin, FOLDERS_PATH, []),
    readJsonObject(supabaseAdmin, FILES_PATH, []),
    readJsonObject(supabaseAdmin, PLAYER_UNITS_PATH, {})
  ]);

  return {
    folders: Array.isArray(folders) ? folders : [],
    files: Array.isArray(files) ? files : [],
    playerUnits: playerUnits && typeof playerUnits === "object" && !Array.isArray(playerUnits)
      ? playerUnits
      : {}
  };
}

export async function saveDocumentFolders(supabaseAdmin, folders) {
  await writeJsonObject(supabaseAdmin, FOLDERS_PATH, folders);
}

export async function saveDocumentFiles(supabaseAdmin, files) {
  await writeJsonObject(supabaseAdmin, FILES_PATH, files);
}

export async function saveDocumentPlayerUnits(supabaseAdmin, playerUnits) {
  await writeJsonObject(supabaseAdmin, PLAYER_UNITS_PATH, playerUnits);
}

export function sortDocumentFolders(folders) {
  return [...folders].sort((a, b) => {
    const parentCompare = String(a.parentId || "").localeCompare(String(b.parentId || ""));
    if (parentCompare !== 0) return parentCompare;
    const orderCompare = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (orderCompare !== 0) return orderCompare;
    return String(a.name || "").localeCompare(String(b.name || ""), "de");
  });
}

export function getDocumentUsedBytes(files) {
  return files.reduce((total, file) => total + Math.max(0, Number(file.size || 0)), 0);
}

export function getFolderDescendantIds(folders, folderId) {
  const result = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    folders.forEach(folder => {
      if (result.has(folder.id)) return;
      if (folder.parentId === folderId || result.has(folder.parentId)) {
        result.add(folder.id);
        changed = true;
      }
    });
  }
  return result;
}

