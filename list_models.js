const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");
dotenv.config();

async function listModels() {
  const key = process.env.GEMINI_API_KEY_1;
  const genAI = new GoogleGenAI(key);
  try {
    const models = await genAI.listModels();
    console.log("Available Models:");
    models.forEach(m => console.log(m.name));
  } catch (error) {
    console.error("Error listing models:", error.message);
  }
}

listModels();
