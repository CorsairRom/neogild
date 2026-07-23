const GEMINI_MODEL = 'gemini-2.0-flash'

export type LlmCategoryResult = {
  category: string
  confidence: number
  reasoning: string
}

export async function classifyWithGemini(input: {
  description: string
  amount: number
  type: string
  categories: Array<{ id: string; name: string; parent_id: string | null }>
}): Promise<LlmCategoryResult | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey?.trim()) return null

  const leafCategories = input.categories.filter((c) => c.parent_id !== null)
  const categoryList = leafCategories
    .map((c) => `- ${c.id}: ${c.name}`)
    .join('\n')

  const prompt = `Clasifica esta transacción financiera chilena en UNA categoría del listado.
Responde SOLO JSON válido: {"category":"<id>","confidence":0.0-1.0,"reasoning":"..."}

Transacción:
- Descripción: ${input.description}
- Monto CLP: ${Math.abs(input.amount)}
- Tipo: ${input.type}

Categorías válidas (usa el id exacto):
${categoryList}

Reglas:
- Supermercados (Jumbo, Lider, etc.) → necesidad.super
- Streaming (Spotify, Netflix) → consumo.entretencion
- Bencina/Copec → necesidad.bencina
- Si no estás seguro, confidence < 0.85`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return null

  const parsed = JSON.parse(text) as {
    category?: string
    confidence?: number
    reasoning?: string
  }
  if (!parsed.category || typeof parsed.confidence !== 'number') return null

  const valid = leafCategories.some((c) => c.id === parsed.category)
  if (!valid) return null

  return {
    category: parsed.category,
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
    reasoning: parsed.reasoning ?? '',
  }
}
