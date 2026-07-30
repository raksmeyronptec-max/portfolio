/*
  netlify/functions/chat.js
  ─────────────────────────────────────────────────────
  Serverless function: receives user message → calls Gemini → returns reply.
*/

const MAX_PER_HOUR = 500; // generous limit for real users
const MAX_PER_MINUTE = 10; // anti-spam: max 10 messages per minute per IP
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// In-memory rate limiting — resets on cold start (fine for serverless)
const ipHistory = {};

// ── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the professional AI Portfolio Assistant for Ron Raksmey. Your goal is to represent Ron to recruiters, educators, parents, and collaborators with high-impact, scannable facts.

### RON RAKSMEY'S PROFILE
- **Identity**: Future Primary School Teacher (12+4 system) based in Phnom Penh, Cambodia.
- **Education**: 
  - Year 2 Student Teacher at **Phnom Penh Teacher Education College (PTEC)** (Expected 2028).
  - Year 3 Bachelor of Mathematics student at **Khemarak University** (Expected 2027).
- **Teaching Expertise**: Specializes in Primary Education, General Mathematics, Algebra, Geometry, Calculus, and early childhood academic development.
- **Technical & Digital Skills**: Proficient in **Microsoft Office**, **Google Workspace**, **LaTeX Typesetting**, **Canva for Education**, and integrating **AI Tools for Education**.
- **Pedagogical Skills**: Expert in Lesson Planning, Student Assessment, and One-on-One Mentoring.

### WHY HIRE / COLLABORATE WITH RON?
- **Academic Excellence**: Achieved an outstanding **3.79 GPA** in his first semester as a Mathematics Major at RUPP. Graduated High School (Cambodia Japan Friendship) with an overall **Grade 'A' (BacII)** in the Science track.
- **Practical Experience**: Completed a teaching practicum at **Capital Practice Primary School (សាលាបឋមសិក្សាអនុវត្តរាជធានី)**, delivering engaging foundational math lessons to young learners.
- **Modern Approach**: Blends theoretical knowledge with modern digital tools to make complex math concepts simple, accessible, and enjoyable for primary students.
- **Availability**: Actively seeking teaching opportunities, tutoring roles, and professional collaborations in Phnom Penh.

### CONTACT RON RAKSMEY
- **Email**: raksmeyron97@gmail.com
- **Telegram**: [@Ron_Raksmey](https://t.me/Ron_Raksmey)
- **Facebook**: [@Ron_Raksmey](https://www.facebook.com/ronraksmey)

### RULES FOR COMMUNICATION
1. **No Duplicates**: When providing links, only use this format: [Telegram Name](URL). Do not repeat the URL.
2. **Be Punchy**: Use short, powerful sentences for easy scanning.
3. **Formatting**: Always use **bold** for keywords and bullet points for lists.
4. **Professional Tone**: Act as a polite, enthusiastic, and highly professional talent agent for Ron.
5. **Call to Action**: Encourage the user to reach out via Email or Telegram.
6. **No Fluff**: Focus on specific achievements (GPA, BacII Grade A, Dual Degrees) and his passion for education.
7. **Stay On Brand**: Always align responses with Ron's profile as a dedicated mathematics educator.
8. **Error Handling**: If you don't understand a question, politely ask for clarification regarding Ron's portfolio.
9. **Limit Responses**: Keep answers concise and strictly relevant to Ron's teaching, education, and skills.
10. **No Personal Opinions**: Stick to factual information from his profile.
11. **Avoid Jargon**: Use clear language suited for an educational context, avoiding overly technical programmer jargon unless referring to his LaTeX/AI skills.
12. **Complete Messages**: Always provide a full, helpful response.`;

// ── HANDLER ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // ── 1. Rate Limiting ────────────────────────────────────────────────────────
  const ip = event.headers["x-nf-client-connection-ip"] || "unknown";
  const now = Date.now();

  // Filter to only requests within the last hour
  const history = (ipHistory[ip] || []).filter((t) => now - t < HOUR_MS);

  // Count requests in the last minute for anti-spam
  const recentMinute = history.filter((t) => now - t < MINUTE_MS);

  if (recentMinute.length >= MAX_PER_MINUTE) {
    console.warn(`Per-minute rate limit hit for IP: ${ip}`);
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error:
          "⏱️ Slow down a little! You can send up to 10 messages per minute. Please wait a moment.",
      }),
    };
  }

  if (history.length >= MAX_PER_HOUR) {
    console.warn(`Hourly rate limit hit for IP: ${ip}`);
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error:
          "🚦 You've reached the hourly limit. Please come back in a little while!",
      }),
    };
  }

  // ── 2. Parse & Validate Request Body ───────────────────────────────────────
  let userMessage, chatHistory;
  try {
    const body = JSON.parse(event.body || "{}");
    userMessage = (body.message || "").trim();
    chatHistory = Array.isArray(body.history) ? body.history : [];
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid request body." }),
    };
  }

  if (!userMessage) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Message cannot be empty." }),
    };
  }

  // ── 3. Validate API Key ─────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is not set.");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server configuration error." }),
    };
  }

  // ── 4. Build Gemini request ─────────────────────────────────────────────────
  const contents = chatHistory
    .filter((m) => m && m.role && m.content)
    .map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: String(msg.content) }],
    }));

  contents.push({ role: "user", parts: [{ text: userMessage }] });

  // ── 5. Call Gemini with timeout ─────────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            maxOutputTokens: 800,
            temperature: 0.6,
          },
        }),
        signal: controller.signal,
      },
    );
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      console.error("Gemini request timed out.");
      return {
        statusCode: 504,
        headers,
        body: JSON.stringify({ error: "⏳ AI timed out. Please try again." }),
      };
    }
    console.error("Fetch error:", err.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "🔌 Failed to reach AI service." }),
    };
  }

  clearTimeout(timeoutId);

  // ── 6. Handle Gemini API errors ─────────────────────────────────────────────
  if (!res.ok) {
    let errMsg = `Gemini API error: ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData?.error?.message || errMsg;
    } catch {
      /* response wasn't JSON */
    }

    console.error(errMsg);

    if (res.status === 429) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          error: "🚦 AI quota exceeded. Please try again shortly.",
        }),
      };
    }

    return {
      statusCode: res.status >= 500 ? 502 : res.status,
      headers,
      body: JSON.stringify({ error: errMsg }),
    };
  }

  // ── 7. Parse reply ──────────────────────────────────────────────────────────
  let reply;
  try {
    const data = await res.json();
    reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  } catch {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Failed to parse AI response." }),
    };
  }

  if (!reply) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "AI returned an empty response." }),
    };
  }

  // ── 8. Record rate-limit entry only on success ──────────────────────────────
  history.push(now);
  ipHistory[ip] = history;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ reply }),
  };
};