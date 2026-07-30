/*
  netlify/functions/contact.js
  ─────────────────────────────────────────────────────────────────────────────
  • Keeps your Telegram bot token SECRET (stored in Netlify env vars, never
    shipped to the browser).
  • Rate-limits by IP address on the server — cannot be bypassed by clearing
    localStorage, using DevTools, curl, Postman, or scripting the form.
  • Validates every field before forwarding to Telegram.
  ─────────────────────────────────────────────────────────────────────────────

  RATE LIMIT RULES (adjust the constants below):
    COOLDOWN_MS   = 2 minutes between sends per IP
    MAX_PER_HOUR  = 3 messages per IP per rolling hour
*/

const COOLDOWN_MS = 2 * 60 * 1000; // 2 min cooldown between messages
const MAX_PER_HOUR = 3; // max sends per IP per hour
const HOUR_MS = 60 * 60 * 1000;

// In-memory store: { [ip]: number[] }  (array of send timestamps)
// This resets when the serverless function cold-starts, but combined with
// the cooldown it's sufficient for stopping casual and semi-technical spam.
const ipHistory = {};

function getClientIP(event) {
  return (
    event.headers["x-nf-client-connection-ip"] || // Netlify real IP
    event.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    event.headers["client-ip"] ||
    "unknown"
  );
}

function checkLimit(ip) {
  const now = Date.now();
  const history = (ipHistory[ip] || []).filter((t) => now - t < HOUR_MS);
  ipHistory[ip] = history; // prune old entries

  if (history.length === 0) return { blocked: false };

  // Cooldown: too soon after last send
  const last = history[history.length - 1];
  const elapsed = now - last;
  if (elapsed < COOLDOWN_MS) {
    const secondsLeft = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return { blocked: true, reason: "cooldown", secondsLeft };
  }

  // Hourly cap
  if (history.length >= MAX_PER_HOUR) {
    const oldest = Math.min(...history);
    const secondsLeft = Math.ceil((HOUR_MS - (now - oldest)) / 1000);
    return { blocked: true, reason: "hourly", secondsLeft };
  }

  return { blocked: false };
}

function recordSend(ip) {
  const now = Date.now();
  const history = (ipHistory[ip] || []).filter((t) => now - t < HOUR_MS);
  history.push(now);
  ipHistory[ip] = history;
}

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*", // Allow all origins to prevent CORS network errors locally
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle preflight OPTIONS request (browsers send this before POST)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { name, email, message } = body;

  // ── Validate fields ──────────────────────────────────────────────────────
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "All fields are required." }),
    };
  }

  const emailRE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRE.test(email.trim())) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid email address." }),
    };
  }

  if (name.trim().length > 100 || message.trim().length > 2000) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Input too long." }),
    };
  }

  // ── Server-side rate limiting ────────────────────────────────────────────
  const ip = getClientIP(event);
  const limit = checkLimit(ip);

  if (limit.blocked) {
    const msg =
      limit.reason === "cooldown"
        ? `Please wait ${limit.secondsLeft} seconds before sending again.`
        : `Too many messages. Try again in ${Math.ceil(limit.secondsLeft / 60)} minutes.`;
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: msg,
        secondsLeft: limit.secondsLeft,
        reason: limit.reason,
      }),
    };
  }

  // ── Forward to Telegram ──────────────────────────────────────────────────
  // ⚠️ SECURITY: this file originally hardcoded a live Telegram bot token and
  // chat id here. They have been REDACTED. The original token is compromised
  // (it was committed in plaintext) and MUST be revoked and regenerated via
  // @BotFather. See docs/AUDIT.md §3. The replacement implementation lives in
  // src/app/api/contact/route.ts and reads env vars only.
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server misconfiguration. Chat ID is missing." }),
    };
  }

  const text = `📬 New message from portfolio\n\n👤 Name: ${name.trim()}\n📧 Email: ${email.trim()}\n💬 Message:\n${message.trim()}`;

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text }),
      },
    );

    if (!tgRes.ok) {
      const err = await tgRes.text();
      console.error("Telegram error:", err);
      throw new Error("Telegram API error");
    }

    recordSend(ip); // only record after a real success

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: "Failed to send message. Please email me directly.",
      }),
    };
  }
};