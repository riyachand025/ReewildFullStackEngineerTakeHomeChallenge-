const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { OpenAIApi, Configuration } = require("openai");

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// POST /eco-score (GPT-powered)
app.post('/eco-score', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  try {
    // Compose a prompt for GPT
    const prompt = `For each of the following clothing items, estimate the carbon footprint in kg CO2 for manufacturing one item, and provide a one-sentence description. Return as JSON with keys: name, carbonScore, description. Items: ${items.join(', ')}`;

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo", // or "gpt-4" if available
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    // Parse GPT's response
    const gptResponse = completion.data.choices[0].message.content;
    let gptData;
    try {
      gptData = JSON.parse(gptResponse);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse GPT response", raw: gptResponse });
    }

    // Calculate total carbon and points
    const totalCarbon = gptData.reduce((sum, item) => sum + (item.carbonScore || 0), 0);
    const points = Math.floor(totalCarbon / 2);

    res.json({ totalCarbon, points, items: gptData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`EcoScan backend running on port ${PORT}`);
});

module.exports = app; 
