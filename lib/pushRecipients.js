export function addDays(dateString, days) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function selectPushRecipients(players, responses, limitations, trainingDate) {
  const settledPlayerIds = new Set(
    (responses || [])
      .filter(response => response.status === "yes" || response.status === "no")
      .map(response => response.player_id)
  );

  const limitedPlayerIds = new Set(
    (limitations || [])
      .filter(limitation => {
        const duration = Number(limitation.duration_days || 0);
        if (!limitation.valid_from || duration < 1) return false;
        const endDate = addDays(limitation.valid_from, duration - 1);
        return trainingDate >= limitation.valid_from && trainingDate <= endDate;
      })
      .map(limitation => limitation.player_id)
  );

  return (players || []).filter(player =>
    player.active !== false &&
    !settledPlayerIds.has(player.id) &&
    !limitedPlayerIds.has(player.id)
  );
}
