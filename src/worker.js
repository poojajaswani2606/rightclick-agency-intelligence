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
    return validTrackerKey(key) && value === true;
  });
}

function validTrackerKey(key) {
  return /^trc-content-tracker:[a-z0-9-]+:2026-\d{2}:w\d+:(Mon|Tue|Wed|Thu|Fri|Sat)$/.test(key);
}

async function readState(env) {
  return (await env.TRACKER_STATE.get(TRACKER_KEY, "json")) || {};
}

async function writeState(env, state) {
  await env.TRACKER_STATE.put(`content-tracker-backup-${Date.now()}`, JSON.stringify(state));
  await env.TRACKER_STATE.put(TRACKER_KEY, JSON.stringify(state));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/tracker" && request.method === "GET") {
      const saved = await readState(env);
      return json({ state: saved || {}, updatedAt: new Date().toISOString() });
    }

    if (url.pathname === "/api/tracker" && request.method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!validTrackerState(body && body.state)) {
        return json({ error: "Invalid tracker state" }, { status: 400 });
      }
      const current = await readState(env);
      const merged = { ...current, ...body.state };
      await writeState(env, merged);
      return json({ ok: true, state: merged, updatedAt: new Date().toISOString() });
    }

    if (url.pathname === "/api/tracker/tick" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !validTrackerKey(body.key) || typeof body.checked !== "boolean") {
        return json({ error: "Invalid tracker tick" }, { status: 400 });
      }
      const current = await readState(env);
      if (body.checked) {
        current[body.key] = true;
      } else {
        delete current[body.key];
      }
      await writeState(env, current);
      return json({ ok: true, state: current, updatedAt: new Date().toISOString() });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
