const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
  try {
    console.log("Testing GPT Vision...");
    console.log("OpenAI API Key:", process.env.OPENAI_API_KEY);
    const result = await openai.chat.completions.create({
      model: "gpt-4o", // <-- use this instead of gpt-4-vision-preview
      messages: [
        { role: "user", content: [{ type: "text", text: "Is this working?" }] }
      ],
      max_tokens: 10
    });
    console.log(result);
  } catch (err) {
    console.error(err);
  }
}

test();