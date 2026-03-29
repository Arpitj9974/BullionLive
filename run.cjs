const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");
dotenv.config();

async function listModels() {
  const key = process.env.GEMINI_API_KEY_1;
  const genAI = new GoogleGenAI({apiKey: key});
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + key);
    const data = await response.json();
    console.log(data.models.map(m => m.name).join("\n"));
  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
