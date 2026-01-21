'use client'

import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useWaterWebGL } from './WaterWebGLContext'

// Vertex shader
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;

  void main() {
    vUv = uv;

    vec3 pos = position;

    // Subtle wave displacement
    float wave = sin(pos.x * 2.0 + uTime * 0.3) * 0.02 +
                 sin(pos.y * 1.5 + uTime * 0.2) * 0.02;
    pos.z += wave;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

// Fragment shader with 3D reflective ripples and caustics
const fragmentShader = /* glsl */ `
  varying vec2 vUv;

  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uDeepColor;
  uniform vec3 uRippleColor;
  uniform vec2 uResolution;
  uniform float uCausticIntensity;
  uniform float uOpacity;
  uniform float uCausticSharpness;
  uniform float uRippleIntensity;
  uniform vec3 uBackgroundColor;

  // Ripple data: vec4(x, y, startTime, strength) for up to 10 ripples
  uniform vec4 uRipples[10];
  uniform int uRippleCount;
  uniform vec3 uCausticColor;

  // Light direction (from top-left)
  const vec2 lightDir = normalize(vec2(-0.7, 0.7));

  // Fast hash function for pseudo-random values
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  // Voronoi/Worley noise - returns F1 and F2 distances
  vec2 voronoi(vec2 uv, float time, float scale, float speed) {
    vec2 scaledUv = uv * scale;
    vec2 cellId = floor(scaledUv);
    vec2 cellUv = fract(scaledUv);

    float minDist1 = 1.0;
    float minDist2 = 1.0;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 cellOffset = cellId + neighbor;

        vec2 randomOffset = hash22(cellOffset);
        randomOffset = 0.5 + 0.4 * sin(time * speed + 6.2831 * randomOffset);

        vec2 diff = neighbor + randomOffset - cellUv;
        float dist = length(diff);

        if (dist < minDist1) {
          minDist2 = minDist1;
          minDist1 = dist;
        } else if (dist < minDist2) {
          minDist2 = dist;
        }
      }
    }

    return vec2(minDist1, minDist2);
  }

  // Multi-layer caustic calculation
  float calculateCaustics(vec2 uv, float time) {
    float caustic = 0.0;

    // Layer 1: Large, slow pattern
    vec2 v1 = voronoi(uv, time, 2.0, 0.08);
    caustic += (v1.y - v1.x) * 0.50;

    // Layer 2: Medium pattern
    vec2 v2 = voronoi(uv, time, 4.0, 0.12);
    caustic += (v2.y - v2.x) * 0.35;

    // Layer 3: Small, faster detail
    vec2 v3 = voronoi(uv, time, 8.0, 0.18);
    caustic += (v3.y - v3.x) * 0.15;

    // uCausticSharpness controls the smoothstep range (lower = sharper)
    return smoothstep(0.0, uCausticSharpness, caustic);
  }

  void main() {
    // Almost imperceptible base wave pattern
    float wave1 = sin(vUv.x * 3.0 + uTime * 0.15) * 0.5 + 0.5;
    float wave2 = sin(vUv.y * 2.5 + uTime * 0.1) * 0.5 + 0.5;
    float combined = (wave1 + wave2) / 2.0;

    // Base color - pristine white with barely perceptible variation
    vec3 color = mix(uBaseColor, uDeepColor, combined * 0.03);

    // Caustic effect - organic light patterns
    float caustic = calculateCaustics(vUv, uTime);
    // Use the caustic color for tinting - works better in dark mode
    float causticStrength = caustic * uCausticIntensity;
    color = mix(color, uCausticColor, causticStrength * 0.5);

    // Ripple effects with 3D lighting
    float totalHighlight = 0.0;
    float totalShadow = 0.0;

    vec2 screenPos = gl_FragCoord.xy;

    for (int i = 0; i < 10; i++) {
      if (i >= uRippleCount) break;

      vec4 ripple = uRipples[i];
      vec2 ripplePos = ripple.xy;
      float rippleAge = ripple.z;
      float rippleStrength = ripple.w;

      vec2 toPixel = screenPos - ripplePos;
      float dist = length(toPixel);

      vec2 radialDir = dist > 0.0 ? normalize(toPixel) : vec2(0.0);

      // Ripple expands over time
      float rippleRadius = rippleAge * 280.0;
      float ringWidth = 45.0;

      // Signed distance to ring (negative = inside, positive = outside)
      float signedDist = dist - rippleRadius;

      // Create smooth ring profile
      float ringProfile = 1.0 - smoothstep(0.0, ringWidth, abs(signedDist));

      // 3D effect: calculate "normal" of the ripple wave
      // Inner edge slopes up, outer edge slopes down
      float normalStrength = smoothstep(ringWidth, 0.0, abs(signedDist));
      float slope = signedDist > 0.0 ? -1.0 : 1.0; // -1 outer slope, +1 inner slope

      // Calculate lighting based on radial direction and light
      float lightDot = dot(radialDir, lightDir);

      // Highlight on the side facing light, shadow on opposite
      float highlight = max(0.0, lightDot * slope) * normalStrength;
      float shadow = max(0.0, -lightDot * slope) * normalStrength * 0.6;

      // Add specular highlight on the ring crest
      float specular = pow(ringProfile, 3.0) * 0.4;

      // Fade based on time and distance
      float timeFade = pow(1.0 - smoothstep(0.0, 3.0, rippleAge), 2.0);
      float distFade = 1.0 - smoothstep(0.0, 700.0, rippleRadius);
      float fade = timeFade * distFade * rippleStrength;

      totalHighlight += (highlight * 0.04 + specular * 0.025) * fade;
      totalShadow += shadow * 0.025 * fade;
    }

    // Apply 3D lighting effect - scaled by ripple intensity
    color = color + vec3(totalHighlight * uRippleIntensity) - vec3(totalShadow * 0.4 * uRippleIntensity);

    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);

    // Mix water color with background based on opacity (for transparent water effect)
    color = mix(uBackgroundColor, color, uOpacity);

    gl_FragColor = vec4(color, 1.0);
  }
`

export function WaterPlane() {
  const meshRef = useRef<THREE.Mesh>(null)
  const { rippleEventsRef } = useWaterWebGL()
  const { viewport, size, gl } = useThree()
  const startTimeRef = useRef<number>(Date.now())

  // Create ripple uniforms array
  const rippleUniforms = useMemo(() => {
    return Array(10).fill(null).map(() => new THREE.Vector4(0, 0, 0, 0))
  }, [])

  // Create shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new THREE.Color('#faf9f7') },  // Warm white
        uDeepColor: { value: new THREE.Color('#f5f3f0') },  // Soft off-white
        uRippleColor: { value: new THREE.Color('#ffffff') },
        uResolution: { value: new THREE.Vector2(1920, 1080) },
        uRipples: { value: rippleUniforms },
        uRippleCount: { value: 0 },
        uCausticIntensity: { value: 0.5 },  // Default, overridden by CSS variable
        uCausticColor: { value: new THREE.Color('#ffffff') },
        uOpacity: { value: 0.6 },  // Default, overridden by CSS variable
        uCausticSharpness: { value: 0.4 },  // Default, overridden by CSS variable (lower = sharper)
        uRippleIntensity: { value: 3.0 },  // Default, overridden by CSS variable (higher = more visible ripples)
        uBackgroundColor: { value: new THREE.Color('#fafafa') },  // White background for light mode
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,  // For proper transparency blending
      side: THREE.DoubleSide,
    })
  }, [rippleUniforms])

  // Theme detection - read colors from CSS variables
  useEffect(() => {
    const updateColors = () => {
      const styles = getComputedStyle(document.documentElement)
      const baseColor = styles.getPropertyValue('--water-base').trim()
      const deepColor = styles.getPropertyValue('--water-deep').trim()
      const rippleColor = styles.getPropertyValue('--water-ripple').trim()
      const causticColor = styles.getPropertyValue('--water-caustic').trim()
      const causticIntensityCSS = styles.getPropertyValue('--water-caustic-intensity').trim()
      const opacityCSS = styles.getPropertyValue('--water-opacity').trim()
      const causticSharpnessCSS = styles.getPropertyValue('--water-caustic-sharpness').trim()
      const rippleIntensityCSS = styles.getPropertyValue('--water-ripple-intensity').trim()
      const backgroundColorCSS = styles.getPropertyValue('--water-background').trim()

      material.uniforms.uBaseColor.value.set(baseColor || '#faf9f7')
      material.uniforms.uDeepColor.value.set(deepColor || '#f5f3f0')
      material.uniforms.uRippleColor.value.set(rippleColor || '#ffffff')
      material.uniforms.uCausticColor.value.set(causticColor || '#ffffff')
      material.uniforms.uBackgroundColor.value.set(backgroundColorCSS || '#fafafa')
      if (causticIntensityCSS) {
        material.uniforms.uCausticIntensity.value = parseFloat(causticIntensityCSS)
      }
      if (opacityCSS) {
        material.uniforms.uOpacity.value = parseFloat(opacityCSS)
      }
      if (causticSharpnessCSS) {
        material.uniforms.uCausticSharpness.value = parseFloat(causticSharpnessCSS)
      }
      if (rippleIntensityCSS) {
        material.uniforms.uRippleIntensity.value = parseFloat(rippleIntensityCSS)
      }
    }

    updateColors()

    const observer = new MutationObserver(updateColors)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [material])

  // Animation frame - update time and ripples
  useFrame(() => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000
    material.uniforms.uTime.value = elapsed

    // Update resolution (use actual canvas size)
    material.uniforms.uResolution.value.set(size.width, size.height)

    // Update ripple uniforms from ripple events
    const ripples = rippleEventsRef.current ?? []
    const now = Date.now()

    // Filter out old ripples (older than 3 seconds)
    const activeRipples = ripples.filter(r => now - r.timestamp < 3000)

    // Get actual framebuffer dimensions from canvas element (not useThree's size which is CSS size)
    const canvas = gl.domElement
    const fbWidth = canvas.width   // Actual framebuffer width
    const fbHeight = canvas.height // Actual framebuffer height
    // DPR = framebuffer size / CSS size
    const dpr = fbWidth / window.innerWidth

    activeRipples.slice(0, 10).forEach((ripple, i) => {
      const age = (now - ripple.timestamp) / 1000 // Age in seconds
      // Convert viewport CSS coords to framebuffer pixels (gl_FragCoord space)
      // clientX/clientY are viewport coordinates in CSS pixels
      // gl_FragCoord.y has origin at bottom, so flip Y
      const pixelX = ripple.clientX * dpr
      const pixelY = fbHeight - (ripple.clientY * dpr)

      rippleUniforms[i].set(pixelX, pixelY, age, ripple.strength)
    })

    // Clear remaining slots
    for (let i = activeRipples.length; i < 10; i++) {
      rippleUniforms[i].set(-10000, -10000, 100, 0) // Far away, old, no strength
    }

    material.uniforms.uRippleCount.value = Math.min(activeRipples.length, 10)
  })

  // Use a large plane that fills the viewport
  const planeWidth = viewport.width * 2
  const planeHeight = viewport.height * 2

  return (
    <mesh ref={meshRef} position={[0, 0, -1]} material={material}>
      <planeGeometry args={[planeWidth, planeHeight, 64, 64]} />
    </mesh>
  )
}
