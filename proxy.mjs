const TARGETS = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    extraHeaders: {
      "HTTP-Referer": "https://openclaw.ai",
      "X-OpenRouter-Title": "OpenClaw",
    },
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    extraHeaders: {},
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    extraHeaders: {},
  },
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*" } };
  }
  const pathParts = event.path.split("/").filter(Boolean);
  const proxyIdx = pathParts.indexOf("proxy");
  const targetName = pathParts[proxyIdx + 1];
  const restPath = "/" + pathParts.slice(proxyIdx + 2).join("/");
  const target = TARGETS[targetName];
  if (!target) return { statusCode: 400, body: JSON.stringify({ error: `Unknown: ${targetName}` }) };

  const targetUrl = target.baseUrl + restPath + (event.rawQuery ? "?" + event.rawQuery : "");
  const headers = {};
  ["authorization","content-type","accept"].forEach(k => { if (event.headers[k]) headers[k] = event.headers[k]; });
  Object.assign(headers, target.extraHeaders);

  try {
    const opts = { method: event.httpMethod, headers };
    if (!["GET","HEAD"].includes(event.httpMethod) && event.body) {
      opts.body = event.isBase64Encoded ? Buffer.from(event.body,"base64").toString() : event.body;
    }
    const resp = await fetch(targetUrl, opts);
    const body = resp.headers.get("content-type")?.includes("json") ? await resp.json() : await resp.text();
    return { statusCode: resp.status, headers: { "Access-Control-Allow-Origin":"*", "Content-Type": resp.headers.get("content-type")||"application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) };
  } catch (err) {
    return { statusCode: 502, headers: { "Access-Control-Allow-Origin":"*", "Content-Type":"application/json" }, body: JSON.stringify({error: err.message}) };
  }
};