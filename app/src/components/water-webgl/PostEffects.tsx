'use client'

import { EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

export function PostEffects() {
  return (
    <EffectComposer multisampling={0}>
      <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      <Vignette offset={0.3} darkness={0.2} blendFunction={BlendFunction.NORMAL} />
    </EffectComposer>
  )
}
