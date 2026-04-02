import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    if (!firstName || !lastName || !username || !email || !birthday || !unit) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const initialPassword = String(birthday).slice(0, 4);
    const displayName = `${firstName} ${lastName}`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: initialPassword,
      email_confirm: true,
      user_metadata: {
        username,
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
        username,
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
        username,
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
      player: playerData
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unexpected server error"
    });
  }
}
