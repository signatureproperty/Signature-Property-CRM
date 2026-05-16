'use client';
import { useRef, useEffect } from 'react';
// @ts-ignore
import { Renderer } from 'ogl';

/**
 * DarkVeil component stub. 
 * Optimized for SSR to prevent "Cannot find module" errors.
 */
export default function DarkVeil({
  hueShift = 0,
  noiseIntensity = 0,
  scanlineIntensity = 0,
  speed = 0.5,
  scanlineFrequency = 0,
  warpAmount = 0,
  resolutionScale = 1
}: any) {
  const ref = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!ref.current || typeof window === 'undefined') return;
    
    try {
        // Canvas animation logic setup with OGL (client-side only)
        const renderer = new Renderer({ canvas: ref.current, antialias: true });
        const gl = renderer.gl;
        console.log("DarkVeil GL context initialized:", gl.RENDERER);
    } catch (e) {
        console.warn("OGL initialization failed (common in some build environments):", e);
    }
    
  }, [hueShift, noiseIntensity, scanlineIntensity, speed, scanlineFrequency, warpAmount, resolutionScale]);

  return (
    <div className="absolute inset-0 z-0 bg-slate-950">
        <canvas ref={ref} className="w-full h-full block" />
    </div>
  );
}
