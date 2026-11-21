const STREAMER_LOGIN = "hier_twitch_name_eintragen";

async function checkStream(env) {
  // 1. Twitch Token holen
  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${env.TWITCH_CLIENT_ID}&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Twitch Token Error ${tokenRes.status}: ${errText} (ID-Länge: ${env.TWITCH_CLIENT_ID?.length}, Secret-Länge: ${env.TWITCH_CLIENT_SECRET?.length})`);
  }
  const { access_token } = await tokenRes.json();

  // 2. Stream-Status abfragen
  const streamRes = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${STREAMER_LOGIN}`,
    {
      headers: {
        "Client-ID": env.TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${access_token}`,
      },
    }
  );
  if (!streamRes.ok) throw new Error(`Twitch API Error: ${streamRes.status}`);
  const { data } = await streamRes.json();
  const stream = data?.[0];

  if (!stream) {
    return `${STREAMER_LOGIN} ist aktuell offline.`;
  }

  // 3. Prüfen, ob schon gemeldet
  const lastId = await env.STATE.get("last_stream_id");
  if (stream.id === lastId) {
    return `Stream ${stream.id} wurde bereits gemeldet.`;
  }

  // 4. Discord Webhook feuern
  const discordRes = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `<@&${env.DISCORD_ROLE_ID}> **${stream.user_name}** ist jetzt live!`,
      embeds: [
        {
          title: stream.title || "Live auf Twitch!",
          url: `https://www.twitch.tv/${STREAMER_LOGIN}`,
          color: 9520895,
          fields: [
            { name: "Kategorie", value: stream.game_name || "Just Chatting", inline: true },
          ],
        },
      ],
    }),
  });
  if (!discordRes.ok) throw new Error(`Discord Webhook Error: ${discordRes.status}`);

  // 5. Stream-ID speichern
  await env.STATE.put("last_stream_id", stream.id);
  return `Ping gesendet für Stream ${stream.id}!`;
}

export default {
  // Läuft automatisch jede Minute per Cron-Trigger
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkStream(env));
  },

  // Ermöglicht manuelles Testen über die Worker-URL im Browser
  async fetch(request, env, ctx) {
    try {
      const result = await checkStream(env);
      return new Response(result, { status: 200 });
    } catch (err) {
      return new Response(`Fehler: ${err.message}`, { status: 500 });
    }
  },
};
