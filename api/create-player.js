import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeUsernamePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9äöüß]/gi, "");
}

function buildBaseUsername(firstName, lastName, providedUsername = "") {
  const cleanedProvided = normalizeUsernamePart(providedUsername);
  if (cleanedProvided) {
    return cleanedProvided;
  }

  const first = normalizeUsernamePart(firstName);
  const last = normalizeUsernamePart(lastName);

  if (!first || !last) {
    return "";
  }

  return `${first.charAt(0)}${last}`;
}

async function usernameExists(username) {
  const { data: profileMatch } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (profileMatch) return true;

  const { data: playerMatch } = await supabaseAdmin
    .from("players")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  return !!playerMatch;
}

async function buildUniqueUsername(firstName, lastName, providedUsername = "") {
  const base = buildBaseUsername(firstName, lastName, providedUsername);
  if (!base) return "";

  let candidate = base;
  let counter = 2;

  while (await usernameExists(candidate)) {
    candidate = `${base}${counter}`;
    counter += 1;
  }

  return candidate;
}

async function emailExists(email) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  return !!data;
}

async function buildSystemEmail(finalUsername, providedEmail = "") {
  const cleanedEmail = String(providedEmail || "").trim().toLowerCase();
  if (cleanedEmail) {
    if (await emailExists(cleanedEmail)) {
      throw new Error("Email already exists");
    }
    return cleanedEmail;
  }

  let candidate = `${finalUsername}@danubedragons.local`;
  let counter = 2;

  while (await emailExists(candidate)) {
    candidate = `${finalUsername}${counter}@danubedragons.local`;
    counter += 1;
  }

  return candidate;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      firstName,
      lastName,
      username,
      email,
      birthday,
      unit
    } = req.body || {};

    if (!firstName || !lastName || !birthday) {
      return res.status(400).json({
        error: "Vorname, Nachname und Geburtstag sind erforderlich."
      });
    }

    const finalUsername = await buildUniqueUsername(firstName, lastName, username);
    if (!finalUsername) {
      return res.status(400).json({
        error: "Loginname konnte nicht erzeugt werden."
      });
    }

    const finalEmail = await buildSystemEmail(finalUsername, email);
    const initialPassword = String(birthday).slice(0, 4);
    const displayName = `${firstName} ${lastName}`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: {
        username: finalUsername,
        display_name: displayName,
        role: "player"
      }
    });

    if (authError || !authData?.user) {
      return res.status(400).json({
        error: authError?.message || "Auth user could not be created"
      });
    }

    const authUserId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert([{
        id: authUserId,
        username: finalUsername,
        display_name: displayName,
        role: "player",
        email: finalEmail,
        must_change_password: true,
        active: true
      }]);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return res.status(400).json({
        error: profileError.message || "Profile could not be created"
      });
    }

    const { data: playerData, error: playerError } = await supabaseAdmin
      .from("players")
      .insert([{
        profile_id: authUserId,
        first_name: firstName,
        last_name: lastName,
        username: finalUsername,
        birthday,
        unit: unit || "",
        active: true
      }])
      .select()
      .single();

    if (playerError) {
      await supabaseAdmin.from("profiles").delete().eq("id", authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return res.status(400).json({
        error: playerError.message || "Player could not be created"
      });
    }

    return res.status(200).json({
      success: true,
      player: playerData,
      username: finalUsername,
      initialPassword,
      email: finalEmail
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unexpected server error"
    });
  }
}
