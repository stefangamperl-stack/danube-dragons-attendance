import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeUsernamePart(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function buildUsername(firstName, lastName, providedUsername = "") {
  const cleanedProvided = normalizeUsernamePart(providedUsername);
  if (cleanedProvided) return cleanedProvided;

  const first = normalizeUsernamePart(firstName);
  const last = normalizeUsernamePart(lastName);

  if (!first || !last) return "";
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
  const base = buildUsername(firstName, lastName, providedUsername);
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
      playerId,
      firstName,
      lastName,
      birthday,
      username,
      email,
      unit
    } = req.body || {};

    if (!playerId || !firstName || !lastName || !birthday) {
      return res.status(400).json({
        error: "playerId, Vorname, Nachname und Geburtstag sind erforderlich."
      });
    }

    const { data: existingPlayer, error: playerLoadError } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("id", playerId)
      .single();

    if (playerLoadError || !existingPlayer) {
      return res.status(404).json({
        error: "Spieler wurde nicht gefunden."
      });
    }

    if (existingPlayer.profile_id) {
      return res.status(400).json({
        error: "Spieler hat bereits ein verknüpftes Profil."
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

    const { data: updatedPlayer, error: playerUpdateError } = await supabaseAdmin
      .from("players")
      .update({
        profile_id: authUserId,
        first_name: firstName,
        last_name: lastName,
        username: finalUsername,
        birthday,
        unit: unit || ""
      })
      .eq("id", playerId)
      .select()
      .single();

    if (playerUpdateError) {
      await supabaseAdmin.from("profiles").delete().eq("id", authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return res.status(400).json({
        error: playerUpdateError.message || "Player could not be updated"
      });
    }

    return res.status(200).json({
      success: true,
      player: updatedPlayer,
      username: finalUsername,
      email: finalEmail,
      initialPassword
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unexpected server error"
    });
  }
}
