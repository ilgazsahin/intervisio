'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Answer = {
  blobUrl?: string
  transcript?: string
  uploading?: boolean
  error?: string | null
  duration?: number
  isEditing?: boolean
}

export default function InterviewPage() {
  const [questions, setQuestions] = useState<string[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [sessionId, setSessionId] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const cv = localStorage.getItem('cv_extracted_text') || ''
        if (!cv || cv.length < 20) {
          setError('No CV detected. Please upload your CV first.')
          setLoading(false)
          return
        }
        // Start session
        const sres = await fetch('http://localhost:8000/start_interview', { method: 'POST' })
        if (!sres.ok) throw new Error('Failed to start interview session')
        const sdata = await sres.json()
        setSessionId(sdata.session_id)

        // Generate questions
        const res = await fetch('http://localhost:8000/generate_questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cv_text: cv }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Failed to generate questions')
        }
        const data = await res.json()
        setQuestions(data.questions || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to initialize interview')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    const setup = async () => {
      try {
        console.log('Requesting camera and microphone permissions...')
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        })
        
        console.log('Media stream obtained:', stream.getTracks().map(t => t.kind))
        streamRef.current = stream
        
        // Set up video display
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch((e) => {
            console.warn('Video play failed:', e)
          })
        }
        
        // Check MediaRecorder support
        if (!window.MediaRecorder) {
          setError('MediaRecorder not supported in this browser. Please use a modern browser.')
          return
        }
        
        // Log supported audio MIME types
        const supportedTypes = [
          'audio/webm',
          'audio/webm;codecs=opus',
          'audio/ogg;codecs=opus',
          'audio/mp4',
          'audio/wav'
        ].filter(type => MediaRecorder.isTypeSupported(type))
        
        console.log('Supported audio MIME types:', supportedTypes)
        
      } catch (e: any) {
        console.error('Media setup error:', e)
        if (e.name === 'NotAllowedError') {
          setError('Camera/Microphone access denied. Please allow permissions and refresh the page.')
        } else if (e.name === 'NotFoundError') {
          setError('No camera or microphone found. Please connect a device and refresh.')
        } else {
          setError(`Media setup failed: ${e.message || 'Unknown error'}`)
        }
      }
    }
    setup()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => {
          console.log('Stopping track:', t.kind)
          t.stop()
        })
      }
    }
  }, [])

  const uploadAndTranscribe = async (blob: Blob) => {
    setAnswers(prev => ({ ...prev, [currentIdx]: { ...prev[currentIdx], uploading: true, error: null } }))
    try {
      const form = new FormData()
      form.append('file', blob, `answer-${currentIdx}.webm`)
      if (sessionId) form.append('session_id', sessionId)
      form.append('question_idx', String(currentIdx))
      const res = await fetch('http://localhost:8000/transcribe_answer', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Transcription failed')
      }
      const data = await res.json()
      setAnswers(prev => ({ ...prev, [currentIdx]: { ...prev[currentIdx], transcript: data.transcript, uploading: false } }))
    } catch (e: any) {
      setAnswers(prev => ({ ...prev, [currentIdx]: { ...prev[currentIdx], error: e?.message || 'Transcription failed', uploading: false } }))
    }
  }

  const startRecording = () => {
    if (!streamRef.current || recording) return
    
    try {
      // Try different audio MIME types in order of preference
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ]
      
      let mediaRecorder: MediaRecorder | null = null
      let mimeType = ''
      
      // Find supported MIME type
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          try {
            mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: type })
            mimeType = type
            break
          } catch (e) {
            continue
          }
        }
      }
      
      // Fallback to default if no specific type works
      if (!mediaRecorder) {
        mediaRecorder = new MediaRecorder(streamRef.current)
        mimeType = mediaRecorder.mimeType || 'audio/webm'
      }
      
      console.log('Using MIME type:', mimeType)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      
      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          console.log('Audio blob created:', blob.size, 'bytes, type:', blob.type)
          
          // Create audio preview URL
          const url = URL.createObjectURL(blob)
          setAnswers(prev => ({ 
            ...prev, 
            [currentIdx]: { 
              ...prev[currentIdx], 
              blobUrl: url,
              error: null 
            } 
          }))
          
          uploadAndTranscribe(blob)
          setRecording(false)
        } catch (e) {
          console.error('Error processing audio recording:', e)
          setAnswers(prev => ({ 
            ...prev, 
            [currentIdx]: { 
              ...prev[currentIdx], 
              error: 'Failed to process audio recording' 
            } 
          }))
          setRecording(false)
        }
      }
      
      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e)
        setError('Audio recording error occurred. Please try again.')
        setRecording(false)
      }
      
      mediaRecorder.start(1000) // Collect data every second
      setRecording(true)
      console.log('Audio recording started')
      
    } catch (e) {
      console.error('Audio recording setup error:', e)
      setError('Audio recording failed to start. Please check microphone permissions.')
    }
  }

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return
    try {
      mediaRecorderRef.current.stop()
    } catch {}
  }

  const goNext = () => {
    setCurrentIdx(i => Math.min(i + 1, Math.max(questions.length - 1, 0)))
  }
  const goBack = () => {
    setCurrentIdx(i => Math.max(i - 1, 0))
  }

  const finishInterview = async () => {
    if (!sessionId) return
    try {
      const res = await fetch('http://localhost:8000/finish_interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (!res.ok) throw new Error('Failed to finish interview')
      alert('Interview finished! You can find it in your profile list soon.')
    } catch (e: any) {
      alert(e?.message || 'Failed to finish interview')
    }
  }

  const currentQuestion = questions[currentIdx] || ''
  const answered = Boolean(answers[currentIdx]?.blobUrl)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 px-4 py-6">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 bg-white rounded-xl shadow p-4 h-[80vh] overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
            <div className="text-sm text-gray-500">{currentIdx + 1}/{Math.max(questions.length || 6, 6)}</div>
          </div>
          <h2 className="font-semibold mb-3">Practice - Level 1</h2>
          <ol className="space-y-2">
            {(questions.length ? questions : Array.from({ length: 6 }, (_, i) => `Question ${i + 1}`)).map((q, i) => (
              <li key={i} className={`flex items-start gap-2 p-2 rounded cursor-pointer ${i === currentIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => setCurrentIdx(i)}>
                <span className={`mt-1 h-4 w-4 rounded-full border ${answers[i]?.blobUrl ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`} />
                <span className="text-sm text-gray-700 line-clamp-2">{q}</span>
              </li>
            ))}
          </ol>
        </aside>

        {/* Main content */}
        <section className="col-span-12 md:col-span-9 bg-white rounded-xl shadow p-6 flex flex-col gap-6">
          {loading ? (
            <div className="text-center text-gray-600">Generating questions…</div>
          ) : error ? (
            <div className="text-red-600 text-center">{error}</div>
          ) : (
            <>
              <div className="text-lg md:text-xl font-semibold text-gray-900">
                {currentQuestion}
              </div>

              <div className="max-w-4xl mx-auto">
                {/* Audio Recording Section */}
                <div className="border-2 border-dashed border-emerald-200 rounded-2xl p-8 flex flex-col gap-6 bg-gradient-to-br from-emerald-50 to-emerald-100">
                  <div className="text-center mb-4">
                    <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Record Your Answer</h3>
                    <p className="text-gray-600 text-sm">
                      See yourself while recording audio only
                    </p>
                  </div>

                  {/* Video Preview */}
                  <div className="w-full aspect-video bg-black rounded-xl overflow-hidden mb-4">
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover" 
                      muted 
                      playsInline 
                      autoPlay
                    />
                  </div>

                  {/* Recording Controls */}
                  <div className="flex items-center justify-center gap-4">
                    {!recording ? (
                      <button 
                        onClick={startRecording} 
                        className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all transform hover:scale-105 shadow-lg"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          Start Recording
                        </div>
                      </button>
                    ) : (
                      <button 
                        onClick={stopRecording} 
                        className="bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition-all transform hover:scale-105 shadow-lg"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Stop Recording
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Status Messages */}
                  <div className="text-center">
                    {answers[currentIdx]?.uploading && (
                      <div className="flex items-center justify-center gap-2 text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-medium">Transcribing your answer...</span>
                      </div>
                    )}
                    {answers[currentIdx]?.error && (
                      <div className="text-red-600 text-sm font-medium">
                        {answers[currentIdx]?.error}
                      </div>
                    )}
                    {answered && !answers[currentIdx]?.uploading && !answers[currentIdx]?.error && (
                      <div className="text-emerald-700 text-sm font-medium">
                        ✓ Answer recorded successfully
                      </div>
                    )}
                  </div>

                  {/* Audio Preview */}
                  {answers[currentIdx]?.blobUrl && (
                    <div className="mt-4 p-4 bg-white rounded-xl border">
                      <div className="text-sm text-gray-600 mb-2 font-medium">Your Answer Preview:</div>
                      <audio 
                        controls 
                        className="w-full"
                        src={answers[currentIdx]?.blobUrl}
                      />
                    </div>
                  )}

                  {/* Transcript Display */}
                  {answers[currentIdx]?.transcript && (
                    <div className="mt-4 p-4 bg-white rounded-xl border">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-gray-800">Transcript:</div>
                        <button
                          onClick={() => setAnswers(prev => ({
                            ...prev,
                            [currentIdx]: {
                              ...prev[currentIdx],
                              isEditing: !prev[currentIdx]?.isEditing
                            }
                          }))}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          {answers[currentIdx]?.isEditing ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </>
                          )}
                        </button>
                      </div>
                      
                      {answers[currentIdx]?.isEditing ? (
                        <div className="space-y-3">
                          <textarea
                            value={answers[currentIdx]?.transcript || ''}
                            onChange={(e) => setAnswers(prev => ({
                              ...prev,
                              [currentIdx]: {
                                ...prev[currentIdx],
                                transcript: e.target.value
                              }
                            }))}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            rows={4}
                            placeholder="Edit your transcript here..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAnswers(prev => ({
                                ...prev,
                                [currentIdx]: {
                                  ...prev[currentIdx],
                                  isEditing: false
                                }
                              }))}
                              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                setAnswers(prev => ({
                                  ...prev,
                                  [currentIdx]: {
                                    ...prev[currentIdx],
                                    isEditing: false
                                  }
                                }))
                                // Here you could also save the updated transcript to backend
                              }}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {answers[currentIdx]?.transcript}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button onClick={goBack} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800" disabled={currentIdx === 0}>Back</button>
                <div className="flex items-center gap-3">
                  <button onClick={finishInterview} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white">Finish Interview</button>
                  <button onClick={goNext} className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Next question</button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
} 