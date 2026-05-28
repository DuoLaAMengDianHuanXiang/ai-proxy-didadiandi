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
    apiKey: () => process.env.GEMINI_API_KEY,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    extraHeaders: {},
  },
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*" } };
  }
  const parts = event.path.split("/").filter(Boolean);
  const proxyIdx = parts.indexOf("proxy");
  if (proxyIdx === -1) return { statusCode: 400, body: "proxy endpoint" };

  const targetName = parts[proxyIdx + 1];
  if (!targetName || !TARGETS[targetName]) {
    return { statusCode: 400, body: JSON.stringify({ error: "Unknown target", available: Object.keys(TARGETS) }) };
  }

  const restPath = "/" + parts.slice(proxyIdx + 2).join("/");
  const target = TARGETS[targetName];
  const targetUrl = target.baseUrl + restPath;
  let qs = event.queryStringParameters ? "?" + new URLSearchParams(event.queryStringParameters).toString() : "";

  // 👇 新增：把 apiKey 注入到 URL
  const targetApiKey = typeof target.apiKey === 'function' ? target.apiKey() : target.apiKey;
  if (targetApiKey) {
    const separator = qs ? '&' : '?';
    qs += separator + 'key=' + encodeURIComponent(targetApiKey);
  }
  // 👆

  const headers = {};
  ["authorization","content-type","accept","x-api-key"].forEach(k => { if (event.headers[k]) headers[k] = event.headers[k]; });
  Object.assign(headers, target.extraHeaders);

  try {
    const opts = { method: event.httpMethod, headers };
    if (!["GET","HEAD"].includes(event.httpMethod) && event.body) {
      opts.body = event.isBase64Encoded ? Buffer.from(event.body,"base64").toString() : event.body;
    }
    const resp = await fetch(targetUrl + qs, opts);
    const ct = resp.headers.get("content-type") || "application/json";
    const body = ct.includes("json") ? JSON.stringify(await resp.json()) : await resp.text();
    return { statusCode: resp.status, headers: { "Access-Control-Allow-Origin":"*", "Content-Type": ct }, body };
  } catch (err) {
    return { statusCode: 502, headers: { "Access-Control-Allow-Origin":"*", "Content-Type":"application/json" }, body: JSON.stringify({error: err.message}) };
  }
};
