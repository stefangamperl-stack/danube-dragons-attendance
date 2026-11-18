import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { requireRole } from "../lib/requireRole.js";
import { selectPushRecipients } from "../lib/pushRecipients.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ROLES = ["adminCoach", "headAdmin"];
const METADATA_KEY = "salix_push_subscriptions";

function normalizeSubscriptions(value) {
  if (!Array.isArray(value)) return [];

  const unique = new Map();
  value.forEach(item => {
    const endpoint = String(item?.endpoint || "").trim();
    const p256dh = String(item?.keys?.p256dh || "").trim();
    const auth = String(item?.keys?.auth || "").trim();
    if (!endpoint.startsWith("https://") || !p256dh || !auth) return;

    unique.set(endpoint, {
      endpoint,
      expirationTime: Number.isFinite(item?.expirationTime) ? item.expirationTime : null,
      keys: { p256dh, auth }
    });
  });

  return [...unique.values()];
}

function formatTrainingDate(dateString) {
  const [year, month, day] = String(dateString || "").split("-");
  return year && month && day ? `${day}.${month}.${year}` : dateString;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authorized = await requireRole(req, res, supabaseAdmin, ALLOWED_ROLES);
    if (!authorized) return;

    const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
    const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
    const subject = String(
      process.env.VAPID_SUBJECT || "https://danube-dragons.vercel.app"
    ).trim();

    if (!publicKey || !privateKey) {
      return res.status(503).json({
        error: "Push-Benachrichtigungen sind noch nicht vollständig eingerichtet."
      });
    }

    const trainingId = String(req.body?.trainingId || "").trim();
    if (!trainingId) {
      return res.status(400).json({ error: "Training ist erforderlich." });
    }

    const { data: training, error: trainingError } = await supabaseAdmin
      .from("trainings")
      .select("id, title, training_date, training_time, location")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      return res.status(404).json({ error: "Training wurde nicht gefunden." });
    }

    const [playersResult, responsesResult, limitationsResult] = await Promise.all([
      supabaseAdmin
        .from("players")
        .select("id, profile_id, active"),
      supabaseAdmin
        .from("responses")
        .select("player_id, status")
        .eq("training_id", trainingId),
      supabaseAdmin
        .from("limitations")
        .select("player_id, valid_from, duration_days")
        .lte("valid_from", training.training_date)
    ]);

    if (playersResult.error) throw playersResult.error;
    if (responsesResult.error) throw responsesResult.error;
    if (limitationsResult.error) throw limitationsResult.error;

    const eligiblePlayers = selectPushRecipients(
      playersResult.data,
      responsesResult.data,
      limitationsResult.data,
      training.training_date
    );

    const playerDestinations = await Promise.all(eligiblePlayers.map(async player => {
      if (!player.profile_id) return { player, user: null, subscriptions: [] };

      const { data, error } = await supabaseAdmin.auth.admin.getUserById(player.profile_id);
      if (error || !data?.user) return { player, user: null, subscriptions: [] };

      return {
        player,
        user: data.user,
        subscriptions: normalizeSubscriptions(data.user.app_metadata?.[METADATA_KEY])
      };
    }));

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const time = String(training.training_time || "").slice(0, 5);
    const body = `Bitte gib für ${formatTrainingDate(training.training_date)} um ${time} deine Zu- oder Absage ab.`;
    const payload = JSON.stringify({
      title: `Erinnerung: ${training.title}`,
      body,
      icon: "/icons/salix-icon-192-v3.png",
      badge: "/icons/salix-icon-192-v3.png",
      tag: `training-${training.id}`,
      data: {
        url: `/?training=${encodeURIComponent(training.id)}`,
        trainingId: training.id
      }
    });

    let sent = 0;
    let failed = 0;
    const staleByUserId = new Map();
    const subscribedPlayers = playerDestinations.filter(item => item.subscriptions.length > 0).length;

    await Promise.all(playerDestinations.flatMap(destination =>
      destination.subscriptions.map(async subscription => {
        try {
          await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 24 });
          sent += 1;
        } catch (error) {
          failed += 1;
          if ((error?.statusCode === 404 || error?.statusCode === 410) && destination.user?.id) {
            const stale = staleByUserId.get(destination.user.id) || new Set();
            stale.add(subscription.endpoint);
            staleByUserId.set(destination.user.id, stale);
          } else {
            console.error("Push-Versand fehlgeschlagen:", error?.statusCode || error?.message || error);
          }
        }
      })
    ));

    await Promise.all(playerDestinations.map(async destination => {
      const staleEndpoints = destination.user?.id
        ? staleByUserId.get(destination.user.id)
        : null;
      if (!staleEndpoints?.size) return;

      const appMetadata = { ...(destination.user.app_metadata || {}) };
      appMetadata[METADATA_KEY] = destination.subscriptions.filter(
        subscription => !staleEndpoints.has(subscription.endpoint)
      );

      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        destination.user.id,
        { app_metadata: appMetadata }
      );
      if (error) console.error("Veraltete Push-Registrierung konnte nicht entfernt werden:", error);
    }));

    return res.status(200).json({
      success: true,
      eligiblePlayers: eligiblePlayers.length,
      subscribedPlayers,
      playersWithoutPush: eligiblePlayers.length - subscribedPlayers,
      sent,
      failed
    });
  } catch (error) {
    console.error("send-training-push error:", error);
    return res.status(500).json({
      error: error.message || "Push-Benachrichtigung konnte nicht gesendet werden."
    });
  }
}
