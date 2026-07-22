import { useState, useEffect } from "react";

// Rileva viewport mobile/portrait. Soglia 768px (sotto = telefono).
// Ritorna { isMobile, isPortrait, vw, vh } e si aggiorna su resize/rotate.
export function useIsMobile(breakpoint = 768) {
  const read = () => ({
    vw: typeof window !== "undefined" ? window.innerWidth : 1280,
    vh: typeof window !== "undefined" ? window.innerHeight : 800,
  });
  const [size, setSize] = useState(read);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSize(read()));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return {
    vw: size.vw,
    vh: size.vh,
    isMobile: size.vw < breakpoint,
    isPortrait: size.vh >= size.vw,
  };
}
