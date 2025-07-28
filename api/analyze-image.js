import { buffer } from 'micro';
import OpenAI from 'openai';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse multipart/form-data using formidable
  const form = formidable();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error parsing form data' });
    }
    const file = files.image;
    if (!file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    const imageBuffer = await fs.promises.readFile(file.filepath);
    const base64Image = imageBuffer.toString('base64');

    try {
      // 1. Use OpenAI Vision model to detect if the image is a clothing item
      const prompt = `Is the object in this image a piece of clothing? If yes, what type of clothing is it (e.g., T-shirt, jeans, dress, etc.)? Reply in JSON: {\"isClothing\": true/false, \"name\": \"type of clothing or null\", \"probability\": 0-1 }`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 200
      });
      const gptResponse = completion.choices[0].message.content;
      console.log("GPT raw response:", gptResponse);
      let detection;
      try {
        const cleaned = gptResponse.replace(/```json|```/g, '').trim();
        detection = JSON.parse(cleaned);
      } catch (e) {
        return res.status(500).json({ error: "Failed to parse GPT response", raw: gptResponse });
      }
      if (!detection.isClothing) {
        return res.json({ items: [], ecoScore: null });
      }
      // 2. Get eco-score for the detected clothing item
      const ecoPrompt = `For the following clothing item, estimate the carbon footprint in kg CO2 for manufacturing one item, and provide a one-sentence description. Return as JSON with keys: name, carbonScore, description. Item: ${detection.name}`;
      const ecoCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: ecoPrompt }],
        temperature: 0.2
      });
      const ecoResponse = ecoCompletion.choices[0].message.content;
      console.log("Eco raw response:", ecoResponse);
      let ecoData;
      try {
        const cleanedEco = ecoResponse.replace(/```json|```/g, '').trim();
        ecoData = JSON.parse(cleanedEco);
      } catch (e) {
        return res.status(500).json({ error: "Failed to parse eco-score GPT response", raw: ecoResponse });
      }
      const totalCarbon = ecoData.carbonScore || 0;
      const points = Math.floor(totalCarbon / 2);
      res.json({
        items: [{ name: detection.name, probability: detection.probability, ...ecoData }],
        ecoScore: { totalCarbon, points }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
} 
