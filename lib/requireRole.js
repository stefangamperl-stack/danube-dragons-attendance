export async function requireRole(req, res, supabaseAdmin, allowedRoles) {
  const authorization = String(req.headers.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    res.status(401).json({ error: "Anmeldung erforderlich." });
    return null;
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(match[1]);
  const user = userData?.user;

  if (userError || !user?.id) {
    res.status(401).json({ error: "Sitzung ist ungültig oder abgelaufen." });
    return null;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.active === false) {
    res.status(403).json({ error: "Aktives Benutzerprofil erforderlich." });
    return null;
  }

  if (!allowedRoles.includes(profile.role)) {
    res.status(403).json({ error: "Keine Berechtigung für diese Aktion." });
    return null;
  }

  return { user, profile };
}
