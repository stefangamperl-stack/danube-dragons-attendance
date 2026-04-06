import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateUsername(firstName = "", lastName = "") {
  const first = firstName.trim().charAt(0).toLowerCase();
  const last = lastName.trim().toLowerCase().replace(/\s+/g, "");
  return `${first}${last}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      firstName,
      lastName,
      email,
      username,
      password,
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

    const finalPassword =
      (password && password.trim()) || "Start1234!";

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
          role: finalRole
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
          first_name: firstName,
          last_name: lastName,
          email: finalEmail,
          username: finalUsername,
          role: finalRole,
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
