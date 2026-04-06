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

function buildUsername(firstName, lastName, providedUsername = "") {
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

    if (!firstName || !lastName || !email || !birthday || !unit) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const finalUsername = buildUsername(firstName, lastName, username);
    if (!finalUsername) {
      return res.status(400).json({ error: "Username could not be generated" });
    }

    const initialPassword = String(birthday).slice(0, 4);
    const displayName = `${firstName} ${lastName}`;

    const { data: existingProfileByUsername, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", finalUsername)
      .maybeSingle();

    if (existingProfileError) {
      return res.status(400).json({
        error: existingProfileError.message || "Username check failed"
      });
    }

    if (existingProfileByUsername) {
      return res.status(400).json({
        error: "Username already exists"
      });
    }

    const { data: existingProfileByEmail, error: existingEmailError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingEmailError) {
      return res.status(400).json({
        error: existingEmailError.message || "Email check failed"
      });
    }

    if (existingProfileByEmail) {
      return res.status(400).json({
        error: "Email already exists"
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
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
        email,
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
        unit,
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
      initialPassword
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unexpected server error"
    });
  }
}
