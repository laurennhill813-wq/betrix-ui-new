// openaiDalle.js
// Generate an image using OpenAI DALL-E for a given event
import axios from "axios";


const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DALLE_MODEL = "dall-e-3";


function buildPrompt(event) {
  // Simple prompt, can be improved for more context
  return `A vibrant, high-quality sports image for a match between ${event.home || "Team A"} and ${event.away || "Team B"} in ${event.league || "a major league"}.`;
}


export async function generateDalleImage(event) {
  if (!OPENAI_KEY) return null;
  const prompt = buildPrompt(event);
  try {
    const resp = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        model: DALLE_MODEL,
        prompt,
        n: 1,
        size: "1024x1024"
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );
    if (resp.data && resp.data.data && resp.data.data[0] && resp.data.data[0].url) {
      return resp.data.data[0].url;
    }
    return null;
  } catch (e) {
    return null;
  }
}
