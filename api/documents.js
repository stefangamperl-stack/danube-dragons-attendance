import { createClient } from "@supabase/supabase-js";
import { requireRole } from "../lib/requireRole.js";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_UNITS,
  MAX_DOCUMENT_FILE_SIZE,
  cleanDocumentName,
  createDocumentId,
  documentUnitsAllow,
  documentUnitsAreSubset,
  ensureDocumentBucket,
  getDocumentStorageLimitBytes,
  getDocumentUsedBytes,
  getFolderDescendantIds,
  loadDocumentMetadata,
  normalizeDocumentUnits,
  saveDocumentFiles,
  saveDocumentFolders,
  saveDocumentPlayerUnits,
  sortDocumentFolders
} from "../lib/documentStore.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALL_ROLES = ["player", "adminCoach", "headAdmin"];
const COACH_ROLES = ["adminCoach", "headAdmin"];

class DocumentValidationError extends Error {}

function isCoach(authorized) {
  return COACH_ROLES.includes(authorized?.profile?.role);
}

async function loadPlayerForProfile(profileId) {
  const { data, error } = await supabaseAdmin
    .from("players")
    .select("id, unit, active")
    .eq("profile_id", profileId)
    .single();

  if (error || !data || data.active === false) return null;
  return data;
}

function filterDocumentsForPlayer(metadata, player) {
  const playerUnits = normalizeDocumentUnits([
    player.unit,
    metadata.playerUnits[player.id]
  ]);

  const accessibleFolders = new Map(
    metadata.folders
      .filter(folder => documentUnitsAllow(folder.units, playerUnits))
      .map(folder => [folder.id, folder])
  );

  const visibleFiles = metadata.files.filter(file =>
    accessibleFolders.has(file.folderId) && documentUnitsAllow(file.units, playerUnits)
  );

  return {
    folders: sortDocumentFolders([...accessibleFolders.values()]),
    files: visibleFiles,
    playerUnits
  };
}

function validateFolderParent(metadata, folderId, parentId, units) {
  if (!parentId) return;
  const parent = metadata.folders.find(folder => folder.id === parentId);
  if (!parent) throw new DocumentValidationError("Der übergeordnete Ordner wurde nicht gefunden.");
  if (!documentUnitsAreSubset(units, parent.units)) {
    throw new DocumentValidationError("Unterordner dürfen nur Positionen enthalten, die auch für den übergeordneten Ordner freigegeben sind.");
  }
  if (folderId) {
    const descendants = getFolderDescendantIds(metadata.folders, folderId);
    if (parentId === folderId || descendants.has(parentId)) {
      throw new DocumentValidationError("Ein Ordner kann nicht in sich selbst oder einen eigenen Unterordner verschoben werden.");
    }
  }
}

async function verifyUploadedPdf(path) {
  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, 60);
  if (signedError || !signed?.signedUrl) throw signedError || new Error("Datei konnte nicht geprüft werden.");

  const response = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-7" } });
  if (!response.ok) throw new Error("Datei konnte nicht geprüft werden.");
  const bytes = Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString("ascii");
  if (bytes !== "%PDF-") throw new Error("Die hochgeladene Datei ist keine gültige PDF-Datei.");
}

async function handleGet(req, res, authorized, metadata) {
  const action = String(req.query?.action || "");

  if (action === "player-units") {
    if (isCoach(authorized)) {
      return res.status(200).json({ playerUnits: metadata.playerUnits });
    }

    const player = await loadPlayerForProfile(authorized.profile.id);
    if (!player) return res.status(404).json({ error: "Spielerprofil wurde nicht gefunden." });
    return res.status(200).json({ playerUnits: { [player.id]: metadata.playerUnits[player.id] || "" } });
  }

  if (action === "download") {
    const fileId = String(req.query?.fileId || "");
    const file = metadata.files.find(item => item.id === fileId);
    const folder = file ? metadata.folders.find(item => item.id === file.folderId) : null;
    if (!file || !folder) return res.status(404).json({ error: "Datei wurde nicht gefunden." });

    if (!isCoach(authorized)) {
      const player = await loadPlayerForProfile(authorized.profile.id);
      if (!player) return res.status(404).json({ error: "Spielerprofil wurde nicht gefunden." });
      const units = [player.unit, metadata.playerUnits[player.id]];
      if (!documentUnitsAllow(folder.units, units) || !documentUnitsAllow(file.units, units)) {
        return res.status(403).json({ error: "Diese Datei ist für deine Position nicht freigegeben." });
      }
    }

    const { data, error } = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(file.storagePath, 90);
    if (error || !data?.signedUrl) {
      return res.status(500).json({ error: "Datei konnte nicht geöffnet werden." });
    }
    return res.status(200).json({ signedUrl: data.signedUrl, expiresIn: 90 });
  }

  const usedBytes = getDocumentUsedBytes(metadata.files);
  const storageLimitBytes = getDocumentStorageLimitBytes();

  if (isCoach(authorized)) {
    return res.status(200).json({
      folders: sortDocumentFolders(metadata.folders),
      files: metadata.files,
      units: DOCUMENT_UNITS,
      storage: {
        usedBytes,
        limitBytes: storageLimitBytes,
        availableBytes: Math.max(0, storageLimitBytes - usedBytes),
        maxFileSizeBytes: MAX_DOCUMENT_FILE_SIZE
      }
    });
  }

  const player = await loadPlayerForProfile(authorized.profile.id);
  if (!player) return res.status(404).json({ error: "Spielerprofil wurde nicht gefunden." });
  const visible = filterDocumentsForPlayer(metadata, player);
  return res.status(200).json({
    folders: visible.folders,
    files: visible.files,
    units: visible.playerUnits
  });
}

async function handlePost(req, res, authorized, metadata) {
  if (!isCoach(authorized)) {
    return res.status(403).json({ error: "Nur Coaches dürfen Dokumente verwalten." });
  }

  const body = req.body || {};
  const action = String(body.action || "");

  if (action === "set-secondary-unit") {
    const playerId = String(body.playerId || "");
    const unit = normalizeDocumentUnits([body.unit])[0] || "";
    const { data: player, error } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("id", playerId)
      .single();
    if (error || !player) return res.status(404).json({ error: "Spieler wurde nicht gefunden." });

    if (unit) metadata.playerUnits[playerId] = unit;
    else delete metadata.playerUnits[playerId];
    await saveDocumentPlayerUnits(supabaseAdmin, metadata.playerUnits);
    return res.status(200).json({ success: true, playerId, unit });
  }

  if (action === "create-folder") {
    const name = cleanDocumentName(body.name);
    const units = normalizeDocumentUnits(body.units);
    const parentId = String(body.parentId || "");
    if (!name) return res.status(400).json({ error: "Bitte einen Ordnernamen eingeben." });
    if (!units.length) return res.status(400).json({ error: "Bitte mindestens eine Position freigeben." });
    validateFolderParent(metadata, null, parentId, units);

    const siblings = metadata.folders.filter(folder => String(folder.parentId || "") === parentId);
    const folder = {
      id: createDocumentId("folder"),
      name,
      parentId: parentId || null,
      units,
      sortOrder: siblings.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    metadata.folders.push(folder);
    await saveDocumentFolders(supabaseAdmin, metadata.folders);
    return res.status(200).json({ success: true, folder });
  }

  if (action === "update-folder") {
    const folder = metadata.folders.find(item => item.id === String(body.folderId || ""));
    if (!folder) return res.status(404).json({ error: "Ordner wurde nicht gefunden." });
    const name = cleanDocumentName(body.name);
    const units = normalizeDocumentUnits(body.units);
    const parentId = String(body.parentId || "");
    if (!name) return res.status(400).json({ error: "Bitte einen Ordnernamen eingeben." });
    if (!units.length) return res.status(400).json({ error: "Bitte mindestens eine Position freigeben." });
    validateFolderParent(metadata, folder.id, parentId, units);
    const incompatibleChild = metadata.folders.find(item =>
      item.parentId === folder.id && !documentUnitsAreSubset(item.units, units)
    );
    const incompatibleFile = metadata.files.find(item =>
      item.folderId === folder.id && !documentUnitsAreSubset(item.units, units)
    );
    if (incompatibleChild || incompatibleFile) {
      return res.status(400).json({
        error: "Bitte passe zuerst die Freigaben der enthaltenen Unterordner und Dateien an."
      });
    }

    folder.name = name;
    folder.units = units;
    if (String(folder.parentId || "") !== parentId) {
      const siblings = metadata.folders.filter(item => String(item.parentId || "") === parentId && item.id !== folder.id);
      folder.parentId = parentId || null;
      folder.sortOrder = siblings.length;
    }
    folder.updatedAt = new Date().toISOString();
    await saveDocumentFolders(supabaseAdmin, metadata.folders);
    return res.status(200).json({ success: true, folder });
  }

  if (action === "move-folder") {
    const folder = metadata.folders.find(item => item.id === String(body.folderId || ""));
    const direction = body.direction === "up" ? -1 : body.direction === "down" ? 1 : 0;
    if (!folder || !direction) return res.status(400).json({ error: "Ordner oder Sortierrichtung ist ungültig." });
    const siblings = sortDocumentFolders(metadata.folders.filter(item => String(item.parentId || "") === String(folder.parentId || "")));
    const index = siblings.findIndex(item => item.id === folder.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
      return res.status(200).json({ success: true });
    }
    [siblings[index], siblings[targetIndex]] = [siblings[targetIndex], siblings[index]];
    siblings.forEach((item, order) => { item.sortOrder = order; });
    await saveDocumentFolders(supabaseAdmin, metadata.folders);
    return res.status(200).json({ success: true });
  }

  if (action === "delete-folder") {
    const folderId = String(body.folderId || "");
    const folder = metadata.folders.find(item => item.id === folderId);
    if (!folder) return res.status(404).json({ error: "Ordner wurde nicht gefunden." });
    if (metadata.folders.some(item => item.parentId === folderId)) {
      return res.status(400).json({ error: "Bitte zuerst alle Unterordner löschen oder verschieben." });
    }
    if (metadata.files.some(item => item.folderId === folderId)) {
      return res.status(400).json({ error: "Bitte zuerst alle Dateien in diesem Ordner löschen oder verschieben." });
    }
    metadata.folders = metadata.folders.filter(item => item.id !== folderId);
    await saveDocumentFolders(supabaseAdmin, metadata.folders);
    return res.status(200).json({ success: true });
  }

  if (action === "prepare-upload") {
    const folder = metadata.folders.find(item => item.id === String(body.folderId || ""));
    const name = cleanDocumentName(body.name || body.fileName, "Dokument.pdf");
    const units = normalizeDocumentUnits(body.units);
    const size = Number(body.size || 0);
    if (!folder) return res.status(404).json({ error: "Ordner wurde nicht gefunden." });
    if (!name.toLowerCase().endsWith(".pdf")) return res.status(400).json({ error: "Es sind nur PDF-Dateien erlaubt." });
    if (!size || size > MAX_DOCUMENT_FILE_SIZE) return res.status(400).json({ error: "Die PDF-Datei ist zu groß oder leer." });
    if (!documentUnitsAreSubset(units, folder.units)) {
      return res.status(400).json({ error: "Die Dateifreigabe muss innerhalb der Ordnerfreigabe liegen." });
    }
    const limit = getDocumentStorageLimitBytes();
    if (getDocumentUsedBytes(metadata.files) + size > limit) {
      return res.status(400).json({ error: "Der verfügbare Dokumentenspeicher reicht für diese Datei nicht aus." });
    }

    const fileId = createDocumentId("file");
    const path = `files/${folder.id}/${fileId}.pdf`;
    const { data, error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) return res.status(500).json({ error: "Upload konnte nicht vorbereitet werden." });
    return res.status(200).json({ success: true, fileId, path, token: data.token, name, units });
  }

  if (action === "finalize-upload") {
    const fileId = String(body.fileId || "");
    const folder = metadata.folders.find(item => item.id === String(body.folderId || ""));
    const path = String(body.path || "");
    const requestedName = cleanDocumentName(body.name, "Dokument.pdf");
    const name = requestedName.toLowerCase().endsWith(".pdf") ? requestedName : `${requestedName}.pdf`;
    const units = normalizeDocumentUnits(body.units);
    if (!folder || !/^file_[0-9a-f-]{36}$/i.test(fileId) || path !== `files/${folder.id}/${fileId}.pdf`) {
      return res.status(400).json({ error: "Uploaddaten sind ungültig." });
    }
    if (metadata.files.some(item => item.id === fileId)) {
      return res.status(409).json({ error: "Diese Datei wurde bereits gespeichert." });
    }
    if (!documentUnitsAreSubset(units, folder.units)) {
      return res.status(400).json({ error: "Die Dateifreigabe muss innerhalb der Ordnerfreigabe liegen." });
    }

    const { data: objects, error: listError } = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .list(`files/${folder.id}`, { search: `${fileId}.pdf`, limit: 10 });
    const object = objects?.find(item => item.name === `${fileId}.pdf`);
    if (listError || !object) return res.status(400).json({ error: "Die hochgeladene Datei wurde nicht gefunden." });
    const size = Number(object.metadata?.size || 0);
    if (!size || size > MAX_DOCUMENT_FILE_SIZE) {
      await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([path]);
      return res.status(400).json({ error: "Die PDF-Datei ist zu groß oder leer." });
    }
    if (getDocumentUsedBytes(metadata.files) + size > getDocumentStorageLimitBytes()) {
      await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([path]);
      return res.status(400).json({ error: "Der verfügbare Dokumentenspeicher reicht für diese Datei nicht aus." });
    }

    try {
      await verifyUploadedPdf(path);
    } catch (error) {
      await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([path]);
      return res.status(400).json({ error: error.message || "Die PDF-Datei ist ungültig." });
    }

    const file = {
      id: fileId,
      folderId: folder.id,
      name,
      units,
      size,
      mimeType: "application/pdf",
      storagePath: path,
      uploadedBy: authorized.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    metadata.files.push(file);
    await saveDocumentFiles(supabaseAdmin, metadata.files);
    return res.status(200).json({ success: true, file });
  }

  if (action === "update-file") {
    const file = metadata.files.find(item => item.id === String(body.fileId || ""));
    if (!file) return res.status(404).json({ error: "Datei wurde nicht gefunden." });
    const folder = metadata.folders.find(item => item.id === file.folderId);
    const name = cleanDocumentName(body.name, file.name);
    const units = normalizeDocumentUnits(body.units);
    if (!folder || !name) return res.status(400).json({ error: "Dateiname oder Ordner ist ungültig." });
    if (!documentUnitsAreSubset(units, folder.units)) {
      return res.status(400).json({ error: "Die Dateifreigabe muss innerhalb der Ordnerfreigabe liegen." });
    }
    file.name = name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
    file.units = units;
    file.updatedAt = new Date().toISOString();
    await saveDocumentFiles(supabaseAdmin, metadata.files);
    return res.status(200).json({ success: true, file });
  }

  if (action === "delete-file") {
    const file = metadata.files.find(item => item.id === String(body.fileId || ""));
    if (!file) return res.status(404).json({ error: "Datei wurde nicht gefunden." });
    const { error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([file.storagePath]);
    if (error) return res.status(500).json({ error: "Datei konnte nicht aus dem Speicher gelöscht werden." });
    metadata.files = metadata.files.filter(item => item.id !== file.id);
    await saveDocumentFiles(supabaseAdmin, metadata.files);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: "Unbekannte Dokumentaktion." });
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authorized = await requireRole(req, res, supabaseAdmin, ALL_ROLES);
    if (!authorized) return;
    await ensureDocumentBucket(supabaseAdmin);
    const metadata = await loadDocumentMetadata(supabaseAdmin);

    if (req.method === "GET") return handleGet(req, res, authorized, metadata);
    return handlePost(req, res, authorized, metadata);
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Dokumentenbereich ist aktuell nicht verfügbar.", error);
    return res.status(500).json({ error: "Dokumentenbereich ist aktuell nicht verfügbar." });
  }
}

