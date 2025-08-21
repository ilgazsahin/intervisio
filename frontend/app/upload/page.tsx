'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'


export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleUpload = async () => {
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)

        setUploading(true)
        setError(null)

        try {
            const res = await fetch('http://localhost:8000/upload_cv', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()
            if (data.extracted_text) {
                localStorage.setItem('cv_extracted_text', data.extracted_text)
                router.push('/')
            } else {
                setError('No text extracted from CV.')
            }
        } catch (error) {
            console.error(error)
            setError('Upload failed')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl font-bold mb-4">Upload Your CV</h1>

            <div className="mb-4">
                <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                />
                <label
                    htmlFor="file-upload"
                    className="cursor-pointer bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded inline-block"
                >
                    Choose File
                </label>

                {file && (
                    <p className="text-sm mt-2 text-gray-700">
                        Selected: <strong>{file.name}</strong>
                    </p>
                )}
            </div>


            <button
                onClick={handleUpload}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={uploading || !file}
            >
                {uploading ? 'Uploading...' : 'Upload CV'}
            </button>

            {error && <p className="mt-4 text-red-500">{error}</p>}

            <Link href="/" passHref>
                <button className="mt-6 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition">
                    ← Back to Home
                </button>
            </Link>
        </div>
    )
}
