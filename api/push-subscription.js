import { createClient } from "@supabase/supabase-js";
import { requireRole } from "../lib/requireRole.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const METADATA_KEY = "salix_push_subscriptions";
const MAX_SUBSCRIPTIONS_PER_PLAYER = 6;

function normalizeSubscription(value) {
  const endpoint = String(value?.endpoint || "").trim();
  const p256dh = String(value?.keys?.p256dh || "").trim();
  const auth = String(value?.keys?.auth || "").trim();

  if (!endpoint.startsWith("https://") || !p256dh || !auth) return null;
  if (endpoint.length > 4096 || p256dh.length > 512 || auth.length > 512) return null;

  return {
    endpoint,
    expirationTime: Number.isFinite(value?.expirationTime) ? value.expirationTime : null,
    keys: { p256dh, auth }
  };
}

function normalizeStoredSubscriptions(value) {
  if (!Array.isArray(value)) return [];

  const unique = new Map();
  value.forEach(item => {
    const subscription = normalizeSubscription(item);
    if (subscription) unique.set(subscription.endpoint, subscription);
  });

  return [...unique.values()].slice(-MAX_SUBSCRIPTIONS_PER_PLAYER);
}

export default async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authorized = await requireRole(req, res, supabaseAdmin, ["player"]);
    if (!authorized) return;

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(authorized.user.id);

    if (userError || !userData?.user) {
      throw userError || new Error("Spieler-Login konnte nicht geladen werden.");
    }

    const appMetadata = { ...(userData.user.app_metadata || {}) };
    let subscriptions = normalizeStoredSubscriptions(appMetadata[METADATA_KEY]);

    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ success: true, count: subscriptions.length });
    }

    if (req.method === "POST") {
      const subscription = normalizeSubscription(req.body?.subscription);
      if (!subscription) {
        return res.status(400).json({ error: "Ungültige Push-Registrierung." });
      }

      subscriptions = subscriptions.filter(item => item.endpoint !== subscription.endpoint);
      subscriptions.push(subscription);
      subscriptions = subscriptions.slice(-MAX_SUBSCRIPTIONS_PER_PLAYER);
    } else {
      const endpoint = String(req.body?.endpoint || "").trim();
      if (!endpoint) {
        return res.status(400).json({ error: "Push-Endpunkt ist erforderlich." });
      }
      subscriptions = subscriptions.filter(item => item.endpoint !== endpoint);
    }

    appMetadata[METADATA_KEY] = subscriptions;
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authorized.user.id,
      { app_metadata: appMetadata }
    );

    if (updateError) throw updateError;

    return res.status(200).json({ success: true, count: subscriptions.length });
  } catch (error) {
    console.error("push-subscription error:", error);
    return res.status(500).json({
      error: error.message || "Push-Einstellung konnte nicht gespeichert werden."
    });
  }
}
