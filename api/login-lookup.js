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
    const { username } = req.body || {};

    const cleanedUsername = String(username || "").trim();
    if (!cleanedUsername) {
      return res.status(400).json({ error: "Username is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, email, active")
      .eq("username", cleanedUsername)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error: error.message || "Lookup failed"
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    if (data.active === false) {
      return res.status(403).json({
        error: "User is inactive"
      });
    }

    if (!data.email) {
      return res.status(400).json({
        error: "No email stored for this user"
      });
    }

    return res.status(200).json({
      success: true,
      email: data.email
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unexpected server error"
    });
  }
}
