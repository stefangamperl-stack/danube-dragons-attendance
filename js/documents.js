const documentLibrary = {
  folders: [],
  files: [],
  storage: null,
  units: [...unitOrder],
  error: ""
};

function isDocumentCoach() {
  return state.currentUser?.role === "adminCoach" || state.currentUser?.role === "headAdmin";
}

async function requestDocuments(query = "", options = {}) {
  const response = await fetch(`/api/documents${query}`, {
    method: options.method || "GET",
    headers: await buildApiAuthHeaders(),
    cache: "no-store",
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(result?.error || "Der Dokumentenbereich konnte nicht geladen werden.");
  }
  return result || {};
}

async function loadDocuments({ silent = false } = {}) {
  try {
    const result = await requestDocuments();
    documentLibrary.folders = Array.isArray(result.folders) ? result.folders : [];
    documentLibrary.files = Array.isArray(result.files) ? result.files : [];
    documentLibrary.storage = result.storage || null;
    documentLibrary.units = Array.isArray(result.units) && result.units.length
      ? result.units
      : [...unitOrder];
    documentLibrary.error = "";
    return true;
  } catch (error) {
    console.error("Fehler beim Laden der Dokumente:", error);
    documentLibrary.error = error.message || "Der Dokumentenbereich konnte nicht geladen werden.";
    if (!silent) alert(documentLibrary.error);
    return false;
  }
}

async function loadDocumentPlayerUnits({ silent = true } = {}) {
  if (!isDocumentCoach()) return;

  try {
    const result = await requestDocuments("?action=player-units");
    const mappings = result.playerUnits || {};
    players.forEach(player => {
      player.secondaryUnit = mappings[player.id] || "";
    });
  } catch (error) {
    console.error("Fehler beim Laden der zweiten Dokumenten-Units:", error);
    if (!silent) alert(error.message || "Die zweite Unit konnte nicht geladen werden.");
  }
}

async function savePlayerDocumentUnit(playerId, unit, { silent = false } = {}) {
  try {
    const result = await requestDocuments("", {
      method: "POST",
      body: { action: "set-secondary-unit", playerId, unit }
    });
    const player = players.find(item => item.id === playerId);
    if (player) player.secondaryUnit = result.unit || "";
    return true;
  } catch (error) {
    console.error("Fehler beim Speichern der zweiten Dokumenten-Unit:", error);
    if (!silent) alert(error.message || "Die zweite Unit konnte nicht gespeichert werden.");
    return false;
  }
}

function formatDocumentBytes(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDocumentDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function renderDocumentUnitSelector(name, selectedUnits = [], allowedUnits = unitOrder) {
  const selected = new Set(selectedUnits || []);
  return `
    <div class="documentUnitGrid" role="group" aria-label="Freigegebene Positionen">
      ${allowedUnits.map(unit => `
        <label class="documentUnitOption ${selected.has(unit) ? "isSelected" : ""}">
          <input type="checkbox" name="${escapeHtml(name)}" value="${unit}" ${selected.has(unit) ? "checked" : ""} />
          <span>${unit}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function getDocumentUnitSelection(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
}

function syncDocumentFolderUnitOptions(parentId, selectorName) {
  const parent = getDocumentFolder(parentId);
  const allowed = new Set(parent?.units || unitOrder);
  document.querySelectorAll(`input[name="${selectorName}"]`).forEach(input => {
    input.disabled = !allowed.has(input.value);
    if (input.disabled) input.checked = false;
  });
}

function getDocumentFolder(folderId) {
  return documentLibrary.folders.find(folder => folder.id === folderId) || null;
}

function getDocumentFolderDescendants(folderId) {
  const result = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    documentLibrary.folders.forEach(folder => {
      if (!result.has(folder.id) && (folder.parentId === folderId || result.has(folder.parentId))) {
        result.add(folder.id);
        changed = true;
      }
    });
  }
  return result;
}

function renderDocumentParentOptions(selectedParentId = "", editingFolderId = "") {
  const blocked = editingFolderId ? getDocumentFolderDescendants(editingFolderId) : new Set();
  return `
    <option value="">Oberste Ebene</option>
    ${documentLibrary.folders
      .filter(folder => folder.id !== editingFolderId && !blocked.has(folder.id))
      .map(folder => `
        <option value="${escapeHtml(folder.id)}" ${folder.id === selectedParentId ? "selected" : ""}>
          ${escapeHtml(folder.name)}
        </option>
      `).join("")}
  `;
}

function renderDocumentFile(file, coachMode) {
  const isEditing = state.editingDocumentFileId === file.id;
  const folder = getDocumentFolder(file.folderId);
  const allowedUnits = folder?.units || unitOrder;

  if (coachMode && isEditing) {
    return `
      <div class="documentFile documentFileEditing">
        <div class="field">
          <label for="documentFileName-${file.id}">Dateiname</label>
          <input id="documentFileName-${file.id}" class="input" value="${escapeHtml(file.name)}" />
        </div>
        <div class="field">
          <label>Sichtbar für Positionen</label>
          ${renderDocumentUnitSelector(`documentFileUnits-${file.id}`, file.units, allowedUnits)}
        </div>
        <div class="rowActions">
          <button class="button" type="button" onclick="updateDocumentFile('${file.id}')">Speichern</button>
          <button class="secondaryButton" type="button" onclick="cancelDocumentFileEdit()">Abbrechen</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="documentFile">
      <div class="documentFileIcon" aria-hidden="true">PDF</div>
      <div class="documentFileInfo">
        <strong>${escapeHtml(file.name)}</strong>
        <span>${formatDocumentBytes(file.size)}${file.createdAt ? ` · ${formatDocumentDate(file.createdAt)}` : ""}</span>
        ${coachMode ? `<span>Freigabe: ${escapeHtml((file.units || []).join(", "))}</span>` : ""}
      </div>
      <div class="documentFileActions">
        <button class="secondaryButton" type="button" onclick="openDocument('${file.id}')">Öffnen</button>
        ${coachMode ? `
          <button class="secondaryButton" type="button" onclick="startDocumentFileEdit('${file.id}')">Bearbeiten</button>
          <button class="dangerButton" type="button" onclick="deleteDocumentFile('${file.id}')">Löschen</button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderCoachDocumentFolder(folder, depth = 0) {
  const isEditing = state.editingDocumentFolderId === folder.id;
  const files = documentLibrary.files.filter(file => file.folderId === folder.id);
  const children = documentLibrary.folders.filter(item => item.parentId === folder.id);
  const parent = folder.parentId ? getDocumentFolder(folder.parentId) : null;
  const allowedUnits = parent?.units || unitOrder;

  return `
    <div class="documentTreeBranch" style="--document-depth:${Math.min(depth, 8)}">
      <section class="documentFolderCard">
        ${isEditing ? `
          <div class="documentFolderEditGrid">
            <div class="field">
              <label for="documentFolderName-${folder.id}">Ordnername</label>
              <input id="documentFolderName-${folder.id}" class="input" value="${escapeHtml(folder.name)}" />
            </div>
            <div class="field">
              <label for="documentFolderParent-${folder.id}">Übergeordneter Ordner</label>
              <select id="documentFolderParent-${folder.id}" class="select" onchange="syncDocumentFolderUnitOptions(this.value,'documentFolderUnits-${folder.id}')">
                ${renderDocumentParentOptions(folder.parentId || "", folder.id)}
              </select>
            </div>
          </div>
          <div class="field">
            <label>Sichtbar für Positionen</label>
            ${renderDocumentUnitSelector(`documentFolderUnits-${folder.id}`, folder.units, allowedUnits)}
          </div>
          <div class="rowActions">
            <button class="button" type="button" onclick="updateDocumentFolder('${folder.id}')">Speichern</button>
            <button class="secondaryButton" type="button" onclick="cancelDocumentFolderEdit()">Abbrechen</button>
          </div>
        ` : `
          <div class="documentFolderHeader">
            <div>
              <div class="documentFolderTitle"><span aria-hidden="true">▾</span> ${escapeHtml(folder.name)}</div>
              <div class="smallMuted">${files.length} ${files.length === 1 ? "Datei" : "Dateien"} · ${escapeHtml((folder.units || []).join(", "))}</div>
            </div>
            <div class="documentFolderActions">
              <button class="iconButton" type="button" title="Nach oben" aria-label="Ordner nach oben" onclick="moveDocumentFolder('${folder.id}','up')">↑</button>
              <button class="iconButton" type="button" title="Nach unten" aria-label="Ordner nach unten" onclick="moveDocumentFolder('${folder.id}','down')">↓</button>
              <button class="secondaryButton" type="button" onclick="startDocumentFolderEdit('${folder.id}')">Bearbeiten</button>
              <button class="dangerButton" type="button" onclick="deleteDocumentFolder('${folder.id}')">Löschen</button>
            </div>
          </div>
        `}

        <div class="documentFiles">
          ${files.map(file => renderDocumentFile(file, true)).join("")}
          ${files.length === 0 ? `<p class="smallMuted documentEmptyHint">Noch keine PDF in diesem Ordner.</p>` : ""}
        </div>

        <div class="documentUploadBox">
          <div class="field">
            <label for="documentUpload-${folder.id}">PDF hinzufügen</label>
            <input id="documentUpload-${folder.id}" class="input" type="file" accept="application/pdf,.pdf" />
          </div>
          <div class="field">
            <label>Sichtbar für Positionen</label>
            ${renderDocumentUnitSelector(`documentUploadUnits-${folder.id}`, folder.units, folder.units)}
          </div>
          <button class="button" type="button" onclick="uploadDocument('${folder.id}')">PDF hochladen</button>
        </div>
      </section>
      ${children.map(child => renderCoachDocumentFolder(child, depth + 1)).join("")}
    </div>
  `;
}

function renderPlayerDocumentFolder(folder, depth = 0) {
  const files = documentLibrary.files.filter(file => file.folderId === folder.id);
  const children = documentLibrary.folders.filter(item => item.parentId === folder.id);
  return `
    <div class="documentTreeBranch playerDocumentBranch" style="--document-depth:${Math.min(depth, 8)}">
      <section class="documentFolderCard playerDocumentFolder">
        <div class="documentFolderHeader">
          <div>
            <div class="documentFolderTitle"><span aria-hidden="true">▾</span> ${escapeHtml(folder.name)}</div>
            <div class="smallMuted">${files.length} ${files.length === 1 ? "Dokument" : "Dokumente"}</div>
          </div>
        </div>
        <div class="documentFiles">
          ${files.map(file => renderDocumentFile(file, false)).join("")}
          ${files.length === 0 ? `<p class="smallMuted documentEmptyHint">Dieser Ordner ist noch leer.</p>` : ""}
        </div>
      </section>
      ${children.map(child => renderPlayerDocumentFolder(child, depth + 1)).join("")}
    </div>
  `;
}

function getRootDocumentFolders() {
  const ids = new Set(documentLibrary.folders.map(folder => folder.id));
  return documentLibrary.folders.filter(folder => !folder.parentId || !ids.has(folder.parentId));
}

function renderDocumentStorage() {
  const storage = documentLibrary.storage;
  if (!storage) return "";
  const percent = storage.limitBytes > 0
    ? Math.min(100, Math.round((storage.usedBytes / storage.limitBytes) * 100))
    : 0;
  return `
    <div class="card documentStorageCard">
      <div class="documentStorageHeader">
        <div>
          <div class="smallMuted">Salix Dokumentenspeicher</div>
          <strong>${formatDocumentBytes(storage.availableBytes)} verfügbar</strong>
        </div>
        <span>${formatDocumentBytes(storage.usedBytes)} von ${formatDocumentBytes(storage.limitBytes)}</span>
      </div>
      <div class="documentStorageTrack" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <span style="width:${percent}%"></span>
      </div>
      <p class="smallMuted">Maximale Größe je PDF: ${formatDocumentBytes(storage.maxFileSizeBytes)}</p>
    </div>
  `;
}

function renderDocumentsView() {
  const content = document.getElementById("content");
  document.getElementById("screenTitle").textContent = "Dokumente";
  document.getElementById("screenSubtitle").textContent = isDocumentCoach()
    ? "Ordner, PDF-Dateien und Positionsfreigaben verwalten"
    : "Für deine Position freigegebene Unterlagen";

  if (documentLibrary.error) {
    content.innerHTML = `
      <div class="card documentErrorCard">
        <h2>Dokumente nicht verfügbar</h2>
        <p>${escapeHtml(documentLibrary.error)}</p>
        <button class="button" type="button" onclick="reloadDocumentsView()">Erneut versuchen</button>
      </div>
    `;
    return;
  }

  const roots = getRootDocumentFolders();

  if (!isDocumentCoach()) {
    content.innerHTML = `
      <div class="documentIntro card">
        <div class="documentIntroIcon" aria-hidden="true">PDF</div>
        <div>
          <h2>Teamdokumente</h2>
          <p class="smallMuted">Hier siehst du ausschließlich Ordner und Dateien, die für deine Unit freigegeben sind.</p>
        </div>
      </div>
      <div class="documentTree playerDocumentTree">
        ${roots.map(folder => renderPlayerDocumentFolder(folder)).join("")}
        ${roots.length === 0 ? `<div class="card"><p class="smallMuted">Für deine Unit sind derzeit keine Dokumentordner freigegeben.</p></div>` : ""}
      </div>
    `;
    return;
  }

  content.innerHTML = `
    ${renderDocumentStorage()}
    <div class="card documentCreateFolderCard">
      <div class="documentSectionHeading">
        <div>
          <h2>Neuen Ordner anlegen</h2>
          <p class="smallMuted">Die Freigabe gilt für den Ordner und begrenzt alle enthaltenen Unterordner und Dateien.</p>
        </div>
      </div>
      <div class="documentFolderEditGrid">
        <div class="field">
          <label for="documentNewFolderName">Ordnername</label>
          <input id="documentNewFolderName" class="input" placeholder="z. B. Playbooks" />
        </div>
        <div class="field">
          <label for="documentNewFolderParent">Übergeordneter Ordner</label>
          <select id="documentNewFolderParent" class="select" onchange="syncDocumentFolderUnitOptions(this.value,'documentNewFolderUnits')">${renderDocumentParentOptions()}</select>
        </div>
      </div>
      <div class="field">
        <label>Sichtbar für Positionen</label>
        ${renderDocumentUnitSelector("documentNewFolderUnits", unitOrder)}
      </div>
      <button class="button" type="button" onclick="createDocumentFolder()">Ordner anlegen</button>
    </div>

    <div class="documentSectionHeading documentLibraryHeading">
      <div>
        <h2>Ordnerstruktur</h2>
        <p class="smallMuted">Mit den Pfeilen änderst du die Reihenfolge innerhalb derselben Ebene.</p>
      </div>
    </div>
    <div class="documentTree coachDocumentTree">
      ${roots.map(folder => renderCoachDocumentFolder(folder)).join("")}
      ${roots.length === 0 ? `<div class="card"><p class="smallMuted">Lege den ersten Ordner für eure Dokumente an.</p></div>` : ""}
    </div>
  `;
}

async function reloadDocumentsView() {
  await loadDocuments();
  renderDocumentsView();
}

async function refreshDocumentManager() {
  await loadDocuments({ silent: true });
  renderDocumentsView();
}

async function createDocumentFolder() {
  const name = document.getElementById("documentNewFolderName")?.value?.trim() || "";
  const parentId = document.getElementById("documentNewFolderParent")?.value || "";
  const units = getDocumentUnitSelection("documentNewFolderUnits");
  if (!name) return alert("Bitte einen Ordnernamen eingeben.");
  if (!units.length) return alert("Bitte mindestens eine Position auswählen.");

  try {
    await requestDocuments("", { method: "POST", body: { action: "create-folder", name, parentId, units } });
    await refreshDocumentManager();
  } catch (error) {
    alert(error.message || "Der Ordner konnte nicht angelegt werden.");
  }
}

function startDocumentFolderEdit(folderId) {
  state.editingDocumentFolderId = folderId;
  state.editingDocumentFileId = null;
  renderDocumentsView();
}

function cancelDocumentFolderEdit() {
  state.editingDocumentFolderId = null;
  renderDocumentsView();
}

async function updateDocumentFolder(folderId) {
  const name = document.getElementById(`documentFolderName-${folderId}`)?.value?.trim() || "";
  const parentId = document.getElementById(`documentFolderParent-${folderId}`)?.value || "";
  const units = getDocumentUnitSelection(`documentFolderUnits-${folderId}`);
  if (!name) return alert("Bitte einen Ordnernamen eingeben.");
  if (!units.length) return alert("Bitte mindestens eine Position auswählen.");

  try {
    await requestDocuments("", { method: "POST", body: { action: "update-folder", folderId, name, parentId, units } });
    state.editingDocumentFolderId = null;
    await refreshDocumentManager();
  } catch (error) {
    alert(error.message || "Der Ordner konnte nicht gespeichert werden.");
  }
}

async function moveDocumentFolder(folderId, direction) {
  try {
    await requestDocuments("", { method: "POST", body: { action: "move-folder", folderId, direction } });
    await refreshDocumentManager();
  } catch (error) {
    alert(error.message || "Die Ordnerreihenfolge konnte nicht geändert werden.");
  }
}

async function deleteDocumentFolder(folderId) {
  const folder = getDocumentFolder(folderId);
  if (!folder || !window.confirm(`Ordner „${folder.name}“ wirklich löschen?`)) return;
  try {
    await requestDocuments("", { method: "POST", body: { action: "delete-folder", folderId } });
    await refreshDocumentManager();
  } catch (error) {
    alert(error.message || "Der Ordner konnte nicht gelöscht werden.");
  }
}

async function uploadDocument(folderId) {
  const input = document.getElementById(`documentUpload-${folderId}`);
  const file = input?.files?.[0];
  const units = getDocumentUnitSelection(`documentUploadUnits-${folderId}`);
  if (!file) return alert("Bitte zuerst eine PDF-Datei auswählen.");
  if (!file.name.toLowerCase().endsWith(".pdf")) return alert("Es sind nur PDF-Dateien erlaubt.");
  if (!units.length) return alert("Bitte mindestens eine Position auswählen.");

  try {
    const prepared = await requestDocuments("", {
      method: "POST",
      body: { action: "prepare-upload", folderId, fileName: file.name, name: file.name, size: file.size, units }
    });
    const { error } = await supabaseClient.storage
      .from("salix-documents")
      .uploadToSignedUrl(prepared.path, prepared.token, file, {
        contentType: "application/pdf",
        upsert: false
      });
    if (error) throw error;

    await requestDocuments("", {
      method: "POST",
      body: {
        action: "finalize-upload",
        folderId,
        fileId: prepared.fileId,
        path: prepared.path,
        name: prepared.name,
        size: file.size,
        units: prepared.units
      }
    });
    await refreshDocumentManager();
  } catch (error) {
    console.error("Fehler beim PDF-Upload:", error);
    alert(error.message || "Die PDF-Datei konnte nicht hochgeladen werden.");
  }
}

function startDocumentFileEdit(fileId) {
  state.editingDocumentFileId = fileId;
  state.editingDocumentFolderId = null;
  renderDocumentsView();
}

function cancelDocumentFileEdit() {
  state.editingDocumentFileId = null;
  renderDocumentsView();
}

async function updateDocumentFile(fileId) {
  const name = document.getElementById(`documentFileName-${fileId}`)?.value?.trim() || "";
  const units = getDocumentUnitSelection(`documentFileUnits-${fileId}`);
  if (!name) return alert("Bitte einen Dateinamen eingeben.");
  if (!units.length) return alert("Bitte mindestens eine Position auswählen.");

  try {
    await requestDocuments("", { method: "POST", body: { action: "update-file", fileId, name, units } });
    state.editingDocumentFileId = null;
    await refreshDocumentManager();
  } catch (error) {
    alert(error.message || "Die Datei konnte nicht gespeichert werden.");
  }
}

async function deleteDocumentFile(fileId) {
  const file = documentLibrary.files.find(item => item.id === fileId);
  if (!file || !window.confirm(`Datei „${file.name}“ wirklich löschen?`)) return;
  try {
    await requestDocuments("", { method: "POST", body: { action: "delete-file", fileId } });
    await refreshDocumentManager();
  } catch (error) {
    alert(error.message || "Die Datei konnte nicht gelöscht werden.");
  }
}

async function openDocument(fileId) {
  const newTab = window.open("", "_blank");
  if (newTab) {
    newTab.opener = null;
    newTab.document.title = "Dokument wird geöffnet";
    newTab.document.body.textContent = "Dokument wird geöffnet …";
  }

  try {
    const result = await requestDocuments(`?action=download&fileId=${encodeURIComponent(fileId)}`);
    if (newTab) newTab.location.replace(result.signedUrl);
    else window.location.assign(result.signedUrl);
  } catch (error) {
    if (newTab) newTab.close();
    alert(error.message || "Die Datei konnte nicht geöffnet werden.");
  }
}
