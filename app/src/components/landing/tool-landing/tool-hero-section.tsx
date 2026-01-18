'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import { Button } from '@/components/ui'
import { useWaterWebGLOptional } from '@/components/water-webgl/WaterWebGLContext'
import type { ToolConfig } from './config'

interface ToolHeroSectionProps {
  tool: ToolConfig
}

export function ToolHeroSection({ tool }: ToolHeroSectionProps) {
  const water = useWaterWebGLOptional()

  const handleLogoClick = (e: React.MouseEvent) => {
    water?.triggerRipple(e.clientX, e.clientY, 1.5)
  }

  return (
    <section className="relative overflow-hidden px-6 py-24 md:px-12 md:py-32">
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Tool logo */}
        <motion.div
          className="mx-auto mb-8 flex w-fit cursor-pointer items-center justify-center rounded-2xl bg-[var(--surface)] p-4"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogoClick}
        >
          <Image
            src={tool.logo}
            alt={tool.name}
            width={140}
            height={50}
            priority
            className="h-12 w-auto"
          />
        </motion.div>

        <h1 className="font-mono text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-6xl">
          Ship faster without
          <span className="block bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-selected)] bg-clip-text text-transparent">
            losing touch with customers
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--text-secondary)] md:text-xl">
          {tool.tagline} Now turn customer conversations into your next features — automatically.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href={`/sign-up?utm_source=landing&utm_content=${tool.utmContent}`}>
            <Button
              size="lg"
              className="w-full bg-[var(--accent-teal)] hover:bg-[var(--accent-teal-hover)] sm:w-auto"
            >
              Request Early Access
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
