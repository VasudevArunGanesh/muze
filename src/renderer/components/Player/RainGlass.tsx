import { useEffect, useRef } from "react";

interface Props {
  backgroundSrc: string;
  width: number;
  height: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level singleton — lives OUTSIDE React's component lifecycle.
//
// Why: dynamic import() is permanently cached by the JS module registry.
// Every `import("raindrop-fx")` after the first returns the same module object.
// RaindropFX internally holds WebGL state. If we destroy+recreate it inside
// React effects, the second constructor call gets a module whose internal
// GL objects point to a dead/missing context → black screen.
//
// Solution: keep ONE canvas and ONE RaindropFX instance alive for the entire
// app session. React mounts/unmounts just wire into this singleton.
// Resize → fx.resize(). Background change → recreate only the fx instance
// on the existing live canvas (context survives, only fx state resets).
// ─────────────────────────────────────────────────────────────────────────────
interface FXSingleton {
  canvas: HTMLCanvasElement;
  fx: any;
  background: string;
}

let singleton: FXSingleton | null = null;
let initPromise: Promise<any> | null = null;

async function getRaindropFX(): Promise<any> {
  if (!initPromise) {
    initPromise = import("raindrop-fx").then((m) => m.default ?? m);
  }
  return initPromise;
}

async function ensureSingleton(
  background: string,
  width: number,
  height: number,
): Promise<FXSingleton> {
  const RaindropFX = await getRaindropFX();

  if (!singleton) {
    // First time — create canvas + fx instance
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const fx = new RaindropFX({
      canvas,
      background,
      spawnSize: [30, 80],
      spawnInterval: [0.1, 0.2],
      mistBlurStep: 5,
      dropletsPerSecond: 100,
    });
    singleton = { canvas, fx, background };
    fx.start();
  } else if (singleton.background !== background) {
    // Background changed — stop old, recreate fx on the SAME canvas
    // (canvas/context stays alive — only the fx object is replaced)
    try {
      singleton.fx.stop();
    } catch {
      /* ignore */
    }

    singleton.canvas.width = width;
    singleton.canvas.height = height;

    const fx = new RaindropFX({
      canvas: singleton.canvas,
      background,
      spawnSize: [30, 80],
      spawnInterval: [0.1, 0.2],
      mistBlurStep: 5,
      dropletsPerSecond: 1000,
    });
    singleton.fx = fx;
    singleton.background = background;
    fx.start();
  } else {
    // Same background, possibly new size
    singleton.canvas.width = width;
    singleton.canvas.height = height;
    try {
      singleton.fx.resize(width, height);
    } catch {
      /* ignore */
    }
  }

  return singleton;
}

function destroySingleton() {
  if (!singleton) return;
  try {
    singleton.fx.stop();
  } catch {
    /* ignore */
  }
  // Detach canvas from DOM if it's still attached
  if (singleton.canvas.parentNode) {
    singleton.canvas.parentNode.removeChild(singleton.canvas);
  }
  singleton = null;
}

// ─────────────────────────────────────────────────────────────────────────────

export function RainGlass({ backgroundSrc, width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const genRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !backgroundSrc) return;

    const gen = ++genRef.current;

    const run = async () => {
      try {
        const { canvas } = await ensureSingleton(backgroundSrc, width, height);
        if (gen !== genRef.current) return; // superseded

        // Attach canvas to this container if not already there
        Object.assign(canvas.style, {
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          display: "block",
        });

        if (canvas.parentNode !== container) {
          // Detach from previous container (if any) before re-attaching
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          container.appendChild(canvas);
        }
      } catch (err) {
        console.warn("[RainGlass] init failed:", err);
      }
    };

    run();

    return () => {
      genRef.current++;
      // Don't destroy — just detach the canvas from DOM.
      // The singleton stays alive so the next mount reuses it instantly.
      if (singleton?.canvas.parentNode === container) {
        container.removeChild(singleton.canvas);
      }
    };
  }, [backgroundSrc, width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    />
  );
}

// Call this if the user navigates away from the player entirely
// and you want to free GPU memory.
export { destroySingleton as destroyRainGlass };
