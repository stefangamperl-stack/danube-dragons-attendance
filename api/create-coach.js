import { createClient } from "@supabase/supabase-js";
import { requireRole } from "../lib/requireRole.js";
import { loginNameToEmailLocalPart, normalizeLoginName } from "../lib/loginName.js";

const INITIAL_PASSWORD = "test123";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateUsername(firstName = "", lastName = "") {
  const first = normalizeLoginName(firstName);
  const last = normalizeLoginName(lastName);
  return `${first.charAt(0)}${last}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authorized = await requireRole(req, res, supabaseAdmin, ["headAdmin"]);
    if (!authorized) return;

    const {
      firstName,
      lastName,
      email,
      username,
      role
    } = req.body || {};

    if (!firstName || !lastName) {
      return res.status(400).json({
        error: "Vorname und Nachname sind Pflichtfelder."
      });
    }

    const finalRole = role === "headAdmin" ? "headAdmin" : "adminCoach";
    const finalUsername = normalizeLoginName(
      username || generateUsername(firstName, lastName)
    );
    if (!finalUsername) {
      return res.status(400).json({ error: "Loginname konnte nicht erzeugt werden." });
    }
    const providedEmail = String(email || "").trim().toLowerCase();
    const emailLocalPart = loginNameToEmailLocalPart(finalUsername);
    let finalEmail = providedEmail ||
      `${emailLocalPart}@danubedragons-attendance.local`;
    const finalPassword = INITIAL_PASSWORD;
    const displayName = `${firstName} ${lastName}`.trim();

    const { data: existingUsername, error: usernameCheckError } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("username", finalUsername)
        .maybeSingle();

    if (usernameCheckError) {
      throw usernameCheckError;
    }

    if (existingUsername) {
      return res.status(409).json({
        error: "Der Loginname ist bereits vergeben."
      });
    }

    let emailCounter = 2;
    while (true) {
      const { data: existingEmail, error: emailCheckError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", finalEmail)
        .maybeSingle();

      if (emailCheckError) throw emailCheckError;
      if (!existingEmail) break;

      if (providedEmail) {
        return res.status(409).json({ error: "Die E-Mail ist bereits vergeben." });
      }

      finalEmail = `${emailLocalPart}${emailCounter}@danubedragons-attendance.local`;
      emailCounter += 1;
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: finalEmail,
        password: finalPassword,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          username: finalUsername,
          role: finalRole,
          display_name: displayName
        }
      });

    if (authError) {
      throw authError;
    }

    const authUser = authData?.user;

    if (!authUser?.id) {
      throw new Error("Auth-User konnte nicht erstellt werden.");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: authUser.id,
          email: finalEmail,
          username: finalUsername,
          role: finalRole,
          display_name: displayName,
          must_change_password: false,
          active: true
        }
      ]);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      throw profileError;
    }

    const { data: coachData, error: coachError } = await supabaseAdmin
      .from("coaches")
      .insert([
        {
          profile_id: authUser.id,
          name: displayName,
          first_name: firstName,
          last_name: lastName,
          email: finalEmail,
          username: finalUsername,
          role: finalRole,
          is_active: true,
          active: true
        }
      ])
      .select()
      .single();

    if (coachError) {
      await supabaseAdmin.from("profiles").delete().eq("id", authUser.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      throw coachError;
    }

    return res.status(200).json({
      success: true,
      coach: coachData,
      credentials: {
        email: finalEmail,
        username: finalUsername,
        password: finalPassword
      }
    });
  } catch (error) {
    console.error("create-coach error:", error);
    return res.status(500).json({
      error: error.message || "Coach konnte nicht erstellt werden."
    });
  }
}
