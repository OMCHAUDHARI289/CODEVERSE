const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
const GEMINI_FALLBACK_MODELS = String(
  process.env.GEMINI_FALLBACK_MODELS ||
    "gemini-2.0-flash-lite-001,gemini-2.0-flash,gemini-flash-lite-latest"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 4000;

// FIX #6: Cache AI results to prevent repeated calls
const aiCache = new Map();

// FIX #1: Max code length to prevent API abuse
const MAX_AI_CODE_LENGTH = 5000;

// FIX fix: Validate complexity format matches Big-O notation
const isValidComplexity = (val) => /o\(.+\)/i.test(String(val || "").trim());

const extractFirstJsonObject = (text = "") => {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || first >= last) return null;

  return raw.slice(first, last + 1);
};

const safeJsonParse = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const buildPrompt = (code) => `Analyze the following code and return:
- Time Complexity (Big-O)
- Space Complexity (Big-O)
- Short explanation

Respond ONLY in JSON format. No text before or after JSON:
{
  "timeComplexity": "...",
  "spaceComplexity": "...",
  "explanation": "..."
}

Code:
\`\`\`
${String(code || "").slice(0, MAX_AI_CODE_LENGTH)}
\`\`\``;

export const analyzeCode = async (code) => {
  if (!GEMINI_API_KEY || !String(code || "").trim()) {
    return null;
  }

  // FIX #1: Limit code size to prevent API abuse
  if (code.length > MAX_AI_CODE_LENGTH) {
    return null;
  }

  // FIX #6: Check cache first to prevent repeated AI calls
  const cacheKey = String(code).slice(0, 2000);
  if (aiCache.has(cacheKey)) {
    return aiCache.get(cacheKey);
  }

  // FIX #3: Safety check for timeout configuration
  if (GEMINI_TIMEOUT_MS > 5000) {
    console.warn("AI timeout is high:", GEMINI_TIMEOUT_MS, "ms - consider reducing for better reliability");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const modelsToTry = Array.from(new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));

  try {
    for (const model of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: buildPrompt(String(code)) }]
            }
          ],
          generationConfig: {
            temperature: 0
          }
        })
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const text =
        payload?.candidates?.[0]?.content?.parts
          ?.map((part) => String(part?.text || ""))
          .join("\n") || "";

      const maybeJson = extractFirstJsonObject(text);
      const parsed = safeJsonParse(maybeJson || text);

      if (!parsed || typeof parsed !== "object") {
        continue;
      }

      const timeComplexity = String(parsed.timeComplexity || "").trim();
      const spaceComplexity = String(parsed.spaceComplexity || "").trim();
      const explanation = String(parsed.explanation || "").trim();

      if (!timeComplexity || !spaceComplexity) {
        continue;
      }

      // FIX #5: Validate complexity format (must be Big-O notation)
      if (!isValidComplexity(timeComplexity) || !isValidComplexity(spaceComplexity)) {
        continue;
      }

      const result = {
        timeComplexity,
        spaceComplexity,
        explanation
      };

      // FIX #6: Cache result before returning
      aiCache.set(cacheKey, result);
      return result;
    }

    // FIX optional: Return fallback if AI fails completely
    const fallback = {
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      explanation: "Fallback estimation - AI analysis unavailable"
    };
    aiCache.set(cacheKey, fallback);
    return fallback;
  } catch {
    // On error, return fallback
    const fallback = {
      timeComplexity: "O(n)",
      spaceComplexity: "O(1)",
      explanation: "Fallback estimation - AI analysis failed"
    };
    aiCache.set(cacheKey, fallback);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
};
