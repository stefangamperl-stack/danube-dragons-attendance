import { createClient } from "@supabase/supabase-js";
import { requireRole } from "../lib/requireRole.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INITIAL_PASSWORD = "test123";

function generateUsername(firstName = "", lastName = "") {
  const first = firstName.trim().charAt(0).toLowerCase();
  const last = lastName.trim().toLowerCase().replace(/\s+/g, "");
  return `${first}${last}`;
}

function deriveNames(coach) {
  const storedFirstName = String(coach.first_name || "").trim();
  const storedLastName = String(coach.last_name || "").trim();
  const storedDisplayName = String(coach.name || "").trim();

  if (storedFirstName && storedLastName) {
    return {
      firstName: storedFirstName,
      lastName: storedLastName,
      displayName: storedDisplayName || `${storedFirstName} ${storedLastName}`
    };
  }

  const nameParts = storedDisplayName.split(/\s+/).filter(Boolean);
  const firstName = storedFirstName || nameParts.shift() || "";
  const lastName = storedLastName || nameParts.join(" ");

  return {
    firstName,
    lastName,
    displayName: storedDisplayName || `${firstName} ${lastName}`.trim()
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let createdAuthUserId = null;

  try {
    const authorized = await requireRole(req, res, supabaseAdmin, ["headAdmin"]);
    if (!authorized) return;

    const coachId = String(req.body?.coachId || "").trim();
    if (!coachId) {
      return res.status(400).json({ error: "Coach-ID fehlt." });
    }

    const { data: coach, error: coachError } = await supabaseAdmin
      .from("coaches")
      .select("id, profile_id, name, first_name, last_name, username, email, role")
      .eq("id", coachId)
      .maybeSingle();

    if (coachError) throw coachError;

    if (!coach) {
      return res.status(404).json({ error: "Der Coach wurde nicht gefunden." });
    }

    if (coach.profile_id) {
      return res.status(409).json({ error: "Für diesen Coach ist bereits ein Login verknüpft." });
    }

    if (coach.role === "headAdmin") {
      return res.status(403).json({
        error: "Logins für Hauptadmins werden nicht über diese Funktion aktiviert."
      });
    }

    const { firstName, lastName, displayName } = deriveNames(coach);
    if (!firstName || !lastName) {
      return res.status(400).json({
        error: "Bitte zuerst Vorname und Nachname des Coaches vollständig speichern."
      });
    }

    const finalUsername = String(coach.username || "").trim() ||
      generateUsername(firstName, lastName);
    const finalEmail = String(coach.email || "").trim() ||
      `${finalUsername}@danubedragons-attendance.local`;

    const { data: existingUsername, error: usernameCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", finalUsername)
      .maybeSingle();

    if (usernameCheckError) throw usernameCheckError;

    if (existingUsername) {
      return res.status(409).json({ error: "Der Loginname ist bereits vergeben." });
    }

    const { data: existingEmail, error: emailCheckError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", finalEmail)
      .maybeSingle();

    if (emailCheckError) throw emailCheckError;

    if (existingEmail) {
      return res.status(409).json({ error: "Die E-Mail ist bereits vergeben." });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password: INITIAL_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        username: finalUsername,
        role: "adminCoach",
        display_name: displayName
      }
    });

    if (authError) throw authError;

    createdAuthUserId = authData?.user?.id || null;
    if (!createdAuthUserId) {
      throw new Error("Auth-Konto konnte nicht erstellt werden.");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: createdAuthUserId,
          email: finalEmail,
          username: finalUsername,
          role: "adminCoach",
          display_name: displayName,
          must_change_password: false,
          active: true
        }
      ]);

    if (profileError) throw profileError;

    const { data: updatedCoach, error: updateCoachError } = await supabaseAdmin
      .from("coaches")
      .update({
        profile_id: createdAuthUserId,
        name: displayName,
        first_name: firstName,
        last_name: lastName,
        username: finalUsername,
        email: finalEmail,
        role: "adminCoach",
        is_active: true,
        active: true
      })
      .eq("id", coach.id)
      .is("profile_id", null)
      .select("id, profile_id, username, email, role")
      .maybeSingle();

    if (updateCoachError) throw updateCoachError;

    if (!updatedCoach?.profile_id) {
      throw new Error("Der Coach konnte nicht mit dem neuen Login verknüpft werden.");
    }

    return res.status(200).json({
      success: true,
      coach: updatedCoach,
      credentials: {
        username: finalUsername,
        email: finalEmail,
        password: INITIAL_PASSWORD
      }
    });
  } catch (error) {
    if (createdAuthUserId) {
      await supabaseAdmin.from("profiles").delete().eq("id", createdAuthUserId);
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
    }

    console.error("activate-coach-login error:", error);
    return res.status(500).json({
      error: error.message || "Der Coach-Login konnte nicht aktiviert werden."
    });
  }
}
