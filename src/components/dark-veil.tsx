'use client';
import { useRef, useEffect, useState } from 'react';

/**
 * DarkVeil component. 
 * Optimized with hydration guard to prevent SSR module resolution errors.
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
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !ref.current || typeof window === 'undefined') return;
    
    // Dynamic import to ensure ogl is only loaded on the client
    const initGL = async () => {
        try {
            const { Renderer } = await import('ogl');
            const renderer = new Renderer({ canvas: ref.current!, antialias: true });
            const gl = renderer.gl;
            console.log("DarkVeil GL context initialized:", gl.RENDERER);
        } catch (e) {
            console.warn("OGL initialization skipped in this environment:", e);
        }
    };
    
    initGL();
    
  }, [mounted, hueShift, noiseIntensity, scanlineIntensity, speed, scanlineFrequency, warpAmount, resolutionScale]);

  if (!mounted) return <div className="absolute inset-0 z-0 bg-slate-950" />;

  return (
    <div className="absolute inset-0 z-0 bg-slate-950">
        <canvas ref={ref} className="w-full h-full block" />
    </div>
  );
}
