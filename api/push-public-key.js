export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  if (!publicKey) {
    return res.status(503).json({
      error: "Push-Benachrichtigungen sind noch nicht vollständig eingerichtet."
    });
  }

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  return res.status(200).json({ publicKey });
}
