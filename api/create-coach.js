import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { requireRole } from "../lib/requireRole.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOOTSTRAP_TOKEN_HASH = "a1c06532cf1bbb9a6c68f6574190282a1c340316dcd2a4a9e9888ffda5a7e7a4";

function generateUsername(firstName = "", lastName = "") {
  const first = firstName.trim().charAt(0).toLowerCase();
  const last = lastName.trim().toLowerCase().replace(/\s+/g, "");
  return `${first}${last}`;
}

function generateTemporaryPassword() {
  return `Salix-${randomBytes(12).toString("base64url")}!7a`;
}

function isValidBootstrapToken(token) {
  if (!token) return false;

  const expected = Buffer.from(BOOTSTRAP_TOKEN_HASH, "hex");
  const actual = Buffer.from(
    createHash("sha256").update(String(token)).digest("hex"),
    "hex"
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const bootstrapToken = String(req.headers["x-salix-bootstrap-token"] || "");
    let bootstrapAuthorized = false;

    if (bootstrapToken) {
      if (!isValidBootstrapToken(bootstrapToken)) {
        return res.status(401).json({ error: "Ungültiger Bootstrap-Zugang." });
      }

      const { count, error: countError } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "headAdmin");

      if (countError) throw countError;

      if ((count || 0) > 0) {
        return res.status(409).json({ error: "Ein Hauptadmin ist bereits vorhanden." });
      }

      if (req.body?.role !== "headAdmin") {
        return res.status(400).json({ error: "Bootstrap ist nur für den ersten Hauptadmin erlaubt." });
      }

      bootstrapAuthorized = true;
    }

    if (!bootstrapAuthorized) {
      const authorized = await requireRole(req, res, supabaseAdmin, ["headAdmin"]);
      if (!authorized) return;
    }

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
    const finalUsername =
      (username && username.trim()) || generateUsername(firstName, lastName);
    const finalEmail =
      (email && email.trim()) ||
      `${finalUsername}@danubedragons-attendance.local`;
    const finalPassword = generateTemporaryPassword();
    const displayName = `${firstName} ${lastName}`.trim();

    const { data: existingUsername, error: usernameCheckError } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", finalUsername)
        .maybeSingle();

    if (usernameCheckError) {
      throw usernameCheckError;
    }

    if (existingUsername) {
      return res.status(409).json({
        error: "Der Loginname ist bereits vergeben."
      });
    }

    const { data: existingEmail, error: emailCheckError } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", finalEmail)
        .maybeSingle();

    if (emailCheckError) {
      throw emailCheckError;
    }

    if (existingEmail) {
      return res.status(409).json({
        error: "Die E-Mail ist bereits vergeben."
      });
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
          must_change_password: true,
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
