import { Chat } from '@/components/chat'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto">
        <div className="py-8">
          <h1 className="text-4xl font-bold text-center mb-2 text-gray-900 dark:text-white">
            AI Chat Application
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
            Powered by Next.js, Vercel AI SDK, and Supabase
          </p>
        </div>
        <Chat />
      </div>
    </main>
  )
}
