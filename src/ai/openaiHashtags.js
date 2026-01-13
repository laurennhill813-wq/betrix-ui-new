// openaiHashtags.js
// Generate hashtags for a sports event using OpenAI
import axios from "axios";


const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4.1";


function buildHashtagPrompt(event) {
  return `Generate 3-5 relevant, trending hashtags (no #betting, no #ad) for a social media post about a match between ${event.home || "Team A"} and ${event.away || "Team B"} in ${event.league || "a major league"}. Return as a JSON array of strings, no explanation.`;
}


export async function generateHashtags(event) {
  if (!OPENAI_KEY) return [];
  const prompt = buildHashtagPrompt(event);
  try {
    const resp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 60,
        temperature: 0.7
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );
    if (resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message && resp.data.choices[0].message.content) {
      const txt = resp.data.choices[0].message.content.trim();
      try {
        const arr = JSON.parse(txt);
        if (Array.isArray(arr)) return arr;
      } catch (e) {
        // fallback: try to extract hashtags from text
        return txt.split(/\s+/).filter(t => t.startsWith('#'));
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}
