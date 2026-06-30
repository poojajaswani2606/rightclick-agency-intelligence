const TRACKER_KEY = "content-tracker-v1";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(init.headers || {})
    }
  });
}

function validTrackerState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  return Object.entries(state).every(([key, value]) => {
    return /^trc-content-tracker:[a-z0-9-]+:2026-\d{2}:w\d+:(Mon|Tue|Wed|Thu|Fri|Sat)$/.test(key) && value === true;
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/tracker" && request.method === "GET") {
      const saved = await env.TRACKER_STATE.get(TRACKER_KEY, "json");
      return json({ state: saved || {}, updatedAt: new Date().toISOString() });
    }

    if (url.pathname === "/api/tracker" && request.method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!validTrackerState(body && body.state)) {
        return json({ error: "Invalid tracker state" }, { status: 400 });
      }
      await env.TRACKER_STATE.put(TRACKER_KEY, JSON.stringify(body.state));
      return json({ ok: true, updatedAt: new Date().toISOString() });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
