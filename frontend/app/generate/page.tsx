'use client'

import { useState, useEffect } from 'react'

export default function GenerateQuestionsPage() {
  const [cvText, setCvText] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('cv_extracted_text')
    if (stored) {
      setCvText(stored)
      handleGenerate(stored)
      localStorage.removeItem('cv_extracted_text')
    }
  }, [])

  const handleGenerate = async (text?: string) => {
    setLoading(true)
    setError(null)
    setQuestions([])

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout

    try {
      const res = await fetch('http://localhost:8000/generate_questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_text: text ?? cvText }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        let detail = 'API error'
        try {
          const data = await res.json()
          detail = data.detail || detail
        } catch {}
        throw new Error(detail)
      }

      const data = await res.json()
      setQuestions(data.questions)
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Request timed out. Please try again.')
      } else {
        setError(err?.message || 'Unexpected error occurred')
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-xl flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-center">Generated Interview Questions</h1>
        <textarea
          className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          placeholder="Paste or edit CV text here..."
          value={cvText}
          onChange={e => setCvText(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          onClick={() => handleGenerate()}
          disabled={loading || !cvText.trim()}
        >
          {loading ? 'Generating...' : 'Regenerate Questions'}
        </button>
        {error && <div className="text-red-600 text-center">{error}</div>}
        {questions.length > 0 && (
          <div>
            <h2 className="font-semibold mb-2">Generated Questions:</h2>
            <ol className="list-decimal list-inside space-y-1">
              {questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
} 