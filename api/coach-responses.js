import { createClient } from "@supabase/supabase-js";
import { requireRole } from "../lib/requireRole.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ROLES = ["adminCoach", "headAdmin"];
const ALLOWED_STATUSES = new Set(["yes", "no"]);
const METADATA_KEY = "salix_training_responses";

function normalizeStoredResponses(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(([, response]) =>
      response &&
      typeof response === "object" &&
      ALLOWED_STATUSES.has(response.status) &&
      typeof response.updatedAt === "string"
    )
  );
}

async function loadVisibleCoachResponses() {
  const { data: coachRows, error: coachesError } = await supabaseAdmin
    .from("coaches")
    .select("id, profile_id, name, first_name, last_name, username, role, active, is_active")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (coachesError) throw coachesError;

  return Promise.all((coachRows || []).map(async coach => {
    if (!coach.profile_id) {
      return { coachId: coach.id, responses: {} };
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(coach.profile_id);

    if (userError || !userData?.user) {
      return { coachId: coach.id, responses: {} };
    }

    return {
      coachId: coach.id,
      responses: normalizeStoredResponses(
        userData.user.app_metadata?.[METADATA_KEY]
      )
    };
  }));
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authorized = await requireRole(req, res, supabaseAdmin, ALLOWED_ROLES);
    if (!authorized) return;

    if (req.method === "GET") {
      const coaches = await loadVisibleCoachResponses();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ success: true, coaches });
    }

    const trainingId = String(req.body?.trainingId || "").trim();
    const status = String(req.body?.status || "").trim();

    if (!trainingId || !ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        error: "Training und gültiger Status sind erforderlich."
      });
    }

    const { data: training, error: trainingError } = await supabaseAdmin
      .from("trainings")
      .select("id")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      return res.status(404).json({ error: "Training wurde nicht gefunden." });
    }

    const { data: coach, error: coachError } = await supabaseAdmin
      .from("coaches")
      .select("id, profile_id, active, is_active")
      .eq("profile_id", authorized.user.id)
      .single();

    if (coachError || !coach || coach.active === false || coach.is_active === false) {
      return res.status(404).json({ error: "Aktives Coach-Profil wurde nicht gefunden." });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(authorized.user.id);

    if (userError || !userData?.user) {
      throw userError || new Error("Coach-Login konnte nicht geladen werden.");
    }

    const updatedAt = new Date().toISOString();
    const appMetadata = { ...(userData.user.app_metadata || {}) };
    const storedResponses = normalizeStoredResponses(appMetadata[METADATA_KEY]);

    storedResponses[trainingId] = { status, updatedAt };
    appMetadata[METADATA_KEY] = storedResponses;

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authorized.user.id,
      { app_metadata: appMetadata }
    );

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      coachId: coach.id,
      trainingId,
      status,
      updatedAt
    });
  } catch (error) {
    console.error("coach-responses error:", error);
    return res.status(500).json({
      error: error.message || "Coach-Antwort konnte nicht verarbeitet werden."
    });
  }
}
