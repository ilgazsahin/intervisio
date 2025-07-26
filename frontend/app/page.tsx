'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative background shapes */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-200 rounded-full opacity-30 blur-2xl z-0" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-300 rounded-full opacity-20 blur-2xl z-0" />

      <section className="relative z-10 flex flex-col items-center gap-8 w-full max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 text-center leading-tight drop-shadow-sm">
          Practice Interviews. <span className="text-blue-600">Boost Confidence.</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-700 text-center max-w-xl">
          Intervisio is your AI-powered interview coach. Upload your CV, get personalized questions, and practice with realistic video interviews.
        </p>

        {/* App mockup / illustration */}
        <div className="w-full flex justify-center">
          <div className="bg-white shadow-xl rounded-3xl p-6 md:p-10 flex flex-col items-center w-full max-w-md">
            {/* Placeholder for app screenshot or SVG */}
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="120" height="120" rx="24" fill="#E0E7FF" />
              <path d="M40 60a20 20 0 1 1 40 0 20 20 0 0 1-40 0z" fill="#3B82F6" />
              <rect x="35" y="80" width="50" height="10" rx="5" fill="#60A5FA" />
            </svg>
            <span className="mt-4 text-gray-500 text-sm text-center">AI Interview Experience Preview</span>
          </div>
        </div>

        <Link href="/upload">
          <button className="mt-6 bg-blue-600 text-white px-8 py-3 rounded-xl text-lg font-semibold shadow-lg hover:bg-blue-700 transition-all">
            Upload Your CV & Start Practicing
          </button>
        </Link>
      </section>

      {/* Optional: Features section */}
      <section className="relative z-10 mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
        <div className="bg-white/80 rounded-2xl shadow p-6 flex flex-col items-center">
          <span className="text-blue-600 text-3xl mb-2">📄</span>
          <h3 className="font-bold text-lg mb-1">CV-Based Questions</h3>
          <p className="text-gray-600 text-center text-sm">Personalized interview questions generated from your uploaded CV.</p>
        </div>
        <div className="bg-white/80 rounded-2xl shadow p-6 flex flex-col items-center">
          <span className="text-blue-600 text-3xl mb-2">🎤</span>
          <h3 className="font-bold text-lg mb-1">Realistic Practice</h3>
          <p className="text-gray-600 text-center text-sm">Answer questions with video and voice for a true-to-life experience.</p>
        </div>
        <div className="bg-white/80 rounded-2xl shadow p-6 flex flex-col items-center">
          <span className="text-blue-600 text-3xl mb-2">⭐</span>
          <h3 className="font-bold text-lg mb-1">Instant Feedback</h3>
          <p className="text-gray-600 text-center text-sm">Get AI-powered feedback and track your improvement over time.</p>
        </div>
      </section>
    </main>
  )
}
