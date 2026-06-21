import { useEffect } from "react";
import { RainPlayerSurface } from "./RainPlayerSurface";

export function FullscreenPlayer({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    window.muze.setPlayerFullscreen(true);
    return () => {
      window.muze.setPlayerFullscreen(false);
    };
  }, []);

  return <RainPlayerSurface variant="fullscreen" onExit={onClose} />;
}
