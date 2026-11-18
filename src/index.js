// prn-preview Worker: serves the static site from ./public and the Pic2Label AI endpoint.
// Providers tried in order: Claude (ANTHROPIC_API_KEY), Gemini (GEMINI_API_KEY), then Workers AI as last resort.
const CLAUDE_MODEL = "claude-sonnet-5-5";
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
const CF_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });

const SYSTEM = `You convert photos of product, shipping and compliance labels into a structured layout for a thermal label printer.
Reply with one JSON object only. No prose, no markdown fences.`;

function userPrompt(b) {
  const size = b.width_mm && b.height_mm
    ? `The real label is ${b.width_mm} mm wide and ${b.height_mm} mm tall.`
    : "The label size is unknown: estimate width_mm and height_mm from typical label sizes and the size of the text.";
  const hints = Array.isArray(b.barcodes) && b.barcodes.length
    ? `Barcodes already decoded from the photo (position in percent of the whole photo): ${JSON.stringify(b.barcodes).slice(0, 2000)}. Use these values as the barcode data.`
    : "";
  return `Read this label photo and return its layout as JSON with exactly this shape:
{"label":{"width_mm":number,"height_mm":number},"elements":[ ... ]}
Each element has "type" ("text", "barcode", "line" or "box") and a bounding box "x","y","w","h" in percent (0-100) of the label's width and height, measured from the label's top-left corner. Ignore anything outside the label.
- text: one element per printed line. "text" = the exact characters (keep case, digits and punctuation), "bold": true or false. The box height is the height of that line of text.
- barcode: "symbology" is one of code128, ean13, upca, code39, gs1-128, qrcode, datamatrix, pdf417. "data" = the encoded value; if you cannot decode it, use the human-readable digits printed under it. Do not add the printed digits again as a separate text element.
- line: a printed rule, with "thickness_mm".
- box: a printed rectangular frame, with "thickness_mm".
${size}
${hints}
List every printed line of text, top to bottom. Never invent text that is not printed.`;
}

function extractJSON(v) {
  if (typeof v !== "string") v = JSON.stringify(v ?? "");
  v = v.replace(/```(?:json)?/gi, "");
  const a = v.indexOf("{"), z = v.lastIndexOf("}");
  if (a < 0 || z <= a) return null;
  try { return JSON.parse(v.slice(a, z + 1)); } catch { return null; }
}

async function pic2label(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);
  if (env.LIMITER) {
    const ip = request.headers.get("cf-connecting-ip") || "anon";
    const { success } = await env.LIMITER.limit({ key: ip });
    if (!success) return json({ error: "Too many conversions in a minute. Wait a moment and try again." }, 429);
  }
  let b;
  try { b = await request.json(); } catch { return json({ error: "Send JSON" }, 400); }
  const img = String(b.image || "");
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(img)) return json({ error: "image must be a JPEG, PNG or WebP data URL" }, 400);
  if (img.length > 4_000_000) return json({ error: "Image too large; send at most about 3 MB" }, 413);
  const num = v => (Number.isFinite(+v) && +v > 0 && +v < 1000 ? +v : null);
  const body = { width_mm: num(b.width_mm), height_mm: num(b.height_mm), barcodes: b.barcodes };
  const prompt = userPrompt(body);
  const [, mime, b64] = img.match(/^data:(image\/\w+);base64,(.*)$/s);
  const providers = [];
  if (env.ANTHROPIC_API_KEY) providers.push(["claude", () => viaClaude(env, env.CLAUDE_MODEL || CLAUDE_MODEL, prompt, mime, b64)]);
  if (env.GEMINI_API_KEY) for (const m of (env.GEMINI_MODEL ? [env.GEMINI_MODEL] : GEMINI_MODELS)) providers.push(["gemini", () => viaGemini(env, m, prompt, mime, b64)]);
  if (env.AI) providers.push(["workers-ai", () => viaWorkersAI(env, prompt, img)]);
  const only = typeof b.provider === "string" ? b.provider : null; // for testing one provider
  const errors = [];
  for (const [name, run] of providers.filter(([n]) => !only || n === only)) {
    try {
      const { text, model } = await run();
      const layout = extractJSON(text);
      if (layout && Array.isArray(layout.elements)) return json({ layout, provider: name, model, errors });
      errors.push(`${name}: reply was not a label layout`);
    } catch (e) { errors.push(`${name}: ${String(e && e.message || e).slice(0, 200)}`); }
  }
  return json({ error: "No AI service could read this photo. " + errors.join(" | ") }, 502);
}

async function viaClaude(env, model, prompt, mime, b64) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model, max_tokens: 4096, system: SYSTEM,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
        { type: "text", text: prompt },
      ] }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} ${j.error && j.error.message || ""}`);
  return { text: (j.content || []).filter(c => c.type === "text").map(c => c.text).join(""), model };
}

async function viaGemini(env, model, prompt, mime, b64) {
  try { return await geminiOnce(env, model, prompt, mime, b64); }
  catch (e) { // free tier often returns 503/429 for a moment: wait and retry once
    if (!/HTTP (503|429|500)/.test(e.message)) throw e;
    await new Promise(r => setTimeout(r, 2500));
    return geminiOnce(env, model, prompt, mime, b64);
  }
}
async function geminiOnce(env, model, prompt, mime, b64) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "low" } },
    }),
    signal: AbortSignal.timeout(50000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} ${j.error && j.error.message || ""}`);
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  return { text: parts.filter(p => p.text && !p.thought).map(p => p.text).join(""), model };
}

async function viaWorkersAI(env, prompt, img) {
  const r = await env.AI.run(CF_MODEL, {
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: img } }] },
    ],
    max_tokens: 3000, temperature: 0.1,
  });
  const v = r && (r.response ?? r.result ?? r);
  return { text: typeof v === "string" ? v : JSON.stringify(v), model: CF_MODEL };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/pic2label") return pic2label(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
