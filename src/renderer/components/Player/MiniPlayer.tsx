import { RainPlayerSurface } from "./RainPlayerSurface";

export function MiniPlayer() {
  return (
    <RainPlayerSurface
      variant="mini"
      onExpand={() => window.muze.maximizeFromMini()}
    />
  );
}
