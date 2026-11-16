export function normalizeLoginName(value) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}.-]/gu, "")
    .replace(/^[.-]+|[.-]+$/g, "");
}

export function loginNameToEmailLocalPart(value) {
  const ascii = normalizeLoginName(value)
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/^\.+|\.+$/g, "");

  return ascii || "user";
}
