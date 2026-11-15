import { createClient } from "@supabase/supabase-js";
import { requireRole } from "../lib/requireRole.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESET_PASSWORD = "test123";
const TARGETS = {
  player: { table: "players", allowedRole: "player" },
  coach: { table: "coaches", allowedRole: "adminCoach" }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authorized = await requireRole(req, res, supabaseAdmin, ["headAdmin"]);
    if (!authorized) return;

    const { targetType, targetId } = req.body || {};
    const targetConfig = TARGETS[targetType];

    if (!targetConfig || !targetId) {
      return res.status(400).json({ error: "Ungültiges Reset-Ziel." });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from(targetConfig.table)
      .select("id, profile_id")
      .eq("id", targetId)
      .maybeSingle();

    if (targetError) throw targetError;

    if (!target) {
      return res.status(404).json({ error: "Die Person wurde nicht gefunden." });
    }

    if (!target.profile_id) {
      return res.status(409).json({ error: "Für diese Person ist kein Login verknüpft." });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, active")
      .eq("id", target.profile_id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || profile.active === false) {
      return res.status(409).json({ error: "Das Benutzerprofil ist nicht aktiv." });
    }

    if (profile.role !== targetConfig.allowedRole) {
      return res.status(403).json({
        error: profile.role === "headAdmin"
          ? "Passwörter von Hauptadmins können hier nicht zurückgesetzt werden."
          : "Die Benutzerrolle passt nicht zum ausgewählten Konto."
      });
    }

    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: RESET_PASSWORD }
    );

    if (passwordError) throw passwordError;

    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", profile.id);

    if (updateProfileError) throw updateProfileError;

    return res.status(200).json({
      success: true,
      mustChangePassword: true
    });
  } catch (error) {
    console.error("reset-password error:", error);
    return res.status(500).json({
      error: error.message || "Das Passwort konnte nicht zurückgesetzt werden."
    });
  }
}
