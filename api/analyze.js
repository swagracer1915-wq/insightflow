// api/analyze.js - Vercel Serverless Function

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { summary, sample, mode } = req.body;

        if (!summary || !sample) {
            return res.status(400).json({ error: 'Missing required data' });
        }

        // Generate prompt based on mode
        const prompt = mode === 'technical' 
            ? generateTechnicalPrompt(summary, sample)
            : generateBusinessPrompt(summary, sample);

        // Call Anthropic API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 800,  // Reduced to control costs
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Anthropic API error:', error);
            throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();
        return res.status(200).json(result);

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: 'Failed to generate insights',
            message: error.message 
        });
    }
}

function generateTechnicalPrompt(summary, sample) {
    return `You are a data scientist analyzing this dataset. Provide 4-5 technical insights.

DATASET SUMMARY:
- Rows: ${summary.rowCount}
- Columns: ${summary.columns.join(', ')}

STATISTICS:
${Object.entries(summary.stats).map(([col, stats]) => 
    `${col}: mean=${stats.mean.toFixed(2)}, median=${stats.median.toFixed(2)}, min=${stats.min}, max=${stats.max}`
).join('\n')}

SAMPLE DATA (first 10 rows):
${JSON.stringify(sample, null, 2)}

Return ONLY valid JSON (no markdown, no preamble):
{
  "insights": [
    {
      "title": "Brief technical title",
      "text": "Detailed analysis with specific metrics, correlations, statistical significance, data quality observations",
      "icon": "📊"
    }
  ]
}

Focus on: statistical patterns, correlations, outliers, data quality, technical recommendations.`;
}

function generateBusinessPrompt(summary, sample) {
    return `You are a business consultant analyzing this dataset. Provide 4-5 actionable business insights.

DATASET SUMMARY:
- Rows: ${summary.rowCount}
- Columns: ${summary.columns.join(', ')}

KEY METRICS:
${Object.entries(summary.stats).map(([col, stats]) => 
    `${col}: total=${stats.sum.toFixed(0)}, average=${stats.mean.toFixed(2)}`
).join('\n')}

SAMPLE DATA (first 10 rows):
${JSON.stringify(sample, null, 2)}

Return ONLY valid JSON (no markdown, no preamble):
{
  "insights": [
    {
      "title": "Brief business title",
      "text": "Clear actionable insight with specific numbers, recommendations, expected outcomes, urgency signals",
      "icon": "💡"
    }
  ]
}

Focus on: revenue opportunities, growth trends, risks, competitive advantages, specific action steps with ROI.`;
}
