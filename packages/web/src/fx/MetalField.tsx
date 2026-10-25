import { useEffect, useRef } from 'react';
import { useReducedMotion } from './motion.ts';

const METAL_VARS = ['--gold', '--silver', '--platinum', '--nickel'] as const;
const TAU = Math.PI * 2;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The hero's signature: four threads of light, one per metal, that drift
 * apart on the left and braid into a single line on the right, the index.
 * Points of light travel along them like prices arriving. The threads lean
 * towards the pointer. It pauses off-screen, and holds still with reduced motion.
 */
export function MetalField({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let compact = false;
    let colors: string[] = [];
    let ink = '#fff';
    let dark = true;
    let visible = true;
    let frame = 0;
    let last = performance.now();
    let t = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, target: 0 };
    const particles = Array.from({ length: 4 * 3 }, (_, k) => ({
      metal: k % 4,
      p: (k * 0.137) % 1,
      speed: 0.035 + ((k * 7) % 5) * 0.008,
    }));

    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      colors = METAL_VARS.map((v) => cs.getPropertyValue(v).trim() || '#c8c8c8');
      ink = cs.getPropertyValue('--text-1').trim() || '#ffffff';
      dark = cs.colorScheme.includes('dark');
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      compact = w < 700;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Vertical position of one strand of one metal at horizontal position x.
    const strandY = (metal: number, strand: number, strands: number, x: number) => {
      const u = x / w;
      const merge = smooth(0.18, 0.8, u);
      // A band along the bottom of the hero, clear of the text above it.
      const band = compact ? 110 : Math.min(h * 0.2, 210);
      const cy = h - band * 0.55;
      const gap = band * 0.13;
      const spread = (metal - 1.5) * gap * (1 - merge);
      const k = [1.6, 2.1, 1.3, 2.6][metal]!;
      const s = [0.55, 0.42, 0.7, 0.36][metal]!;
      const amp = band * 0.16 * (1 - merge * 0.85);
      const wave = Math.sin(u * k * TAU + t * s + strand * 0.45 + metal) * amp;
      const common =
        Math.sin(u * 2.3 + t * 0.32) * band * 0.12 + Math.sin(u * 6.1 - t * 0.47) * band * 0.04;
      const ribbon = (strand - (strands - 1) / 2) * (1.2 + 7 * (1 - merge));
      let y = cy + spread + wave + common + ribbon;
      if (pointer.strength > 0.01) {
        const dx = x - pointer.x;
        const pull = Math.exp(-(dx * dx) / (2 * (w * 0.12) ** 2));
        y += (pointer.y - y) * 0.22 * pull * pointer.strength * (1 - merge * 0.6);
      }
      return y;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      const strands = compact ? 3 : 5;
      const step = compact ? 10 : 6;
      for (let metal = 0; metal < 4; metal++) {
        ctx.strokeStyle = colors[metal]!;
        for (let strand = 0; strand < strands; strand++) {
          const centre = strand === Math.floor(strands / 2);
          for (const pass of centre ? [0, 1] : [1]) {
            ctx.beginPath();
            for (let x = -step; x <= w + step; x += step) {
              const y = strandY(metal, strand, strands, x);
              if (x === -step) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            // pass 0: a wide, faint glow; pass 1: the thread itself
            ctx.lineWidth = pass === 0 ? 7 : centre ? 1.6 : 0.8;
            ctx.globalAlpha =
              pass === 0 ? (dark ? 0.05 : 0.04) : centre ? 0.75 : dark ? 0.28 : 0.35;
            ctx.stroke();
          }
        }
      }

      // Prices travelling along each metal's thread, into the index.
      for (const part of particles) {
        const x = part.p * w;
        const y = strandY(part.metal, Math.floor(strands / 2), strands, x);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 10);
        glow.addColorStop(0, colors[part.metal]!);
        glow.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.9 * Math.sin(Math.PI * part.p);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, TAU);
        ctx.fill();
      }

      // The index: where the four become one, a steady point with a slow pulse.
      const nx = w * 0.82;
      const ny = strandY(0, Math.floor(strands / 2), strands, nx);
      const pulse = (t * 0.35) % 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.6 * (1 - pulse);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(nx, ny, 4 + pulse * 26, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(nx, ny, 3.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      pointer.strength += (pointer.target - pointer.strength) * 0.05;
      for (const part of particles) part.p = (part.p + part.speed * dt) % 1;
      draw();
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      if (reduced) {
        draw();
        return;
      }
      if (!visible || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const inside =
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right;
      pointer.tx = event.clientX - rect.left;
      pointer.ty = event.clientY - rect.top;
      pointer.target = inside ? 1 : 0;
    };
    const onLeave = () => (pointer.target = 0);

    readTheme();
    resize();
    t = 2.4;
    start();

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else cancelAnimationFrame(frame);
    });
    io.observe(canvas);
    const themeObserver = new MutationObserver(() => {
      readTheme();
      if (reduced) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => {
      readTheme();
      if (reduced) draw();
    };
    scheme.addEventListener('change', onScheme);
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      scheme.removeEventListener('change', onScheme);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [reduced]);

  return (
    <canvas ref={canvasRef} className={`metal-field ${className}`.trim()} aria-hidden="true" />
  );
}
