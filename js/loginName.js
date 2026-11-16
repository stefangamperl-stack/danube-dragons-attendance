function normalizeLoginName(value) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}.-]/gu, "")
    .replace(/^[.-]+|[.-]+$/g, "");
}
