require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 45000);
  const maxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 256);

  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY in environment.');
    process.exit(1);
  }
  if (!modelName) {
    console.error('Missing GEMINI_MODEL in environment.');
    process.exit(1);
  }

  console.log(`Using model: ${modelName}`);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens,
      responseMimeType: 'application/json'
    }
  });

  const prompt = [
    'Return only valid JSON with this exact shape:',
    '{"ok":true,"provider":"gemini","timestamp":"ISO-8601"}',
    'No markdown, no extra keys, no explanation.'
  ].join(' ');

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const response = await Promise.race([model.generateContent(prompt), timeoutPromise]);
  clearTimeout(timeoutId);

  const text = response.response.text();
  console.log('Raw response:', text);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse JSON response:', err.message);
    process.exit(1);
  }

  const valid =
    parsed &&
    parsed.ok === true &&
    parsed.provider === 'gemini' &&
    typeof parsed.timestamp === 'string';

  if (!valid) {
    console.error('JSON parsed but shape is invalid:', parsed);
    process.exit(1);
  }

  console.log('Gemini smoke test passed.');
}

main().catch((err) => {
  const msg = String(err && err.message ? err.message : err);
  if (msg.toLowerCase().includes('api key')) {
    console.error('Gemini auth error. Check GEMINI_API_KEY and key permissions.');
  } else if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('429')) {
    console.error('Gemini quota/rate-limit error:', msg);
  } else if (msg.toLowerCase().includes('model')) {
    console.error('Gemini model error. Verify GEMINI_MODEL is correct:', msg);
  } else {
    console.error('Gemini smoke test failed:', msg);
  }
  process.exit(1);
});
