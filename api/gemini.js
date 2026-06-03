const DEFAULT_MODEL = 'gemini-2.0-flash'

function readGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('').trim() || ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' })
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: '서버에 Gemini API 키가 설정되지 않았습니다.' })
  }

  const { prompt, json = false, model = DEFAULT_MODEL } = req.body || {}
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt가 필요합니다.' })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: json ? { responseMimeType: 'application/json' } : undefined,
        }),
      },
    )

    const data = await upstream.json().catch(() => null)
    if (!upstream.ok) {
      const message = data?.error?.message || `Gemini 요청 실패: ${upstream.status}`
      return res.status(upstream.status).json({ error: message })
    }

    return res.status(200).json({ text: readGeminiText(data) })
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'Gemini 요청 시간이 초과되었습니다.'
      : error.message || 'Gemini 요청 중 오류가 발생했습니다.'
    return res.status(500).json({ error: message })
  } finally {
    clearTimeout(timeoutId)
  }
}
