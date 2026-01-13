import Script from 'next/script'

export const metadata = {
  title: 'Welcome to Hissuno',
  description: 'Complete your profile to get started',
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Lemon Squeezy checkout overlay script */}
      <Script
        src="https://assets.lemonsqueezy.com/lemon.js"
        strategy="lazyOnload"
      />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </>
  )
}
