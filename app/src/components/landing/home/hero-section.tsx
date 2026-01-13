'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { Button } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'

export function HeroSection() {
  const water = useWaterWebGLOptional()

  const handleLogoClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
  }

  return (
    <section className="relative overflow-hidden px-6 py-24 md:px-12 md:py-32">
      {/* Large decorative background logo */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03]"
        animate={{
          scale: [1, 1.02, 1],
          rotate: [0, 1, -1, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Image
          src="/logo.png"
          alt=""
          width={800}
          height={800}
          className="select-none"
          aria-hidden
        />
      </motion.div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Interactive logo that triggers ripples */}
        <motion.div
          className="mx-auto mb-8 w-fit cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogoClick}
        >
          <Image src="/logo.png" alt="Hissuno" width={180} height={60} priority />
        </motion.div>

        <h1 className="font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl">
          Turn Customer Conversations into
          <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            Engineering Work
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl">
          Hissuno is an AI-powered customer intelligence platform that converts customer conversations
          into actionable issues, product specs, and code changes.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/sign-up">
            <Button
              size="lg"
              className="w-full bg-[var(--accent-teal)] hover:bg-[var(--accent-teal-hover)] sm:w-auto"
            >
              Start Free Trial
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
