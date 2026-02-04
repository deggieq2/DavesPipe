const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function readTop10(env) {
  const data = await env.LEADERBOARD_KV.get("top10", "json");
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => {
      if (!entry || typeof entry.score !== "number") return null;
      return {
        score: entry.score,
        name: entry.name || "Dave",
        ts: entry.ts || Date.now(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

async function writeTop10(env, list) {
  await env.LEADERBOARD_KV.put("top10", JSON.stringify(list));
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...DEFAULT_HEADERS,
      ...(init.headers || {}),
    },
  });
}

export default {
  async fetch(request, env) {
    const { method } = request;
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: DEFAULT_HEADERS });
    }

    if (method === "GET") {
      const top10 = await readTop10(env);
      return jsonResponse({ top10 });
    }

    if (method === "POST") {
      let payload = null;
      try {
        payload = await request.json();
      } catch (err) {
        return jsonResponse({ error: "Invalid JSON" }, { status: 400 });
      }

      const score = Number(payload?.score);
      if (!Number.isFinite(score) || score < 0) {
        return jsonResponse({ error: "Invalid score" }, { status: 400 });
      }

      const name = typeof payload?.name === "string" && payload.name.trim()
        ? payload.name.trim().slice(0, 16)
        : "Dave";

      const current = await readTop10(env);
      const next = [...current, { score, name, ts: Date.now() }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      await writeTop10(env, next);
      return jsonResponse({ top10: next });
    }

    return new Response("Method Not Allowed", {
      status: 405,
      headers: DEFAULT_HEADERS,
    });
  },
};
