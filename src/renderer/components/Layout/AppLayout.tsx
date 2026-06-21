import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { WindowControls } from "./WindowControls";
import { PlayerBar } from "../Player/PlayerBar";
import { MiniPlayer } from "../Player/MiniPlayer";
import { FullscreenPlayer } from "../Player/FullscreenPlayer";
import { ArtistView } from "../Library/ArtistView";
import { AlbumView } from "../Library/AlbumView";
import { AllSongsView } from "../Library/AllSongsView";
import { RatedView } from "../Library/RatedView";
import { RecentView } from "../Library/RecentView";
import { ScanningOverlay } from "./ScanningOverlay";
import { useLibraryStore } from "../../store/libraryStore";
import { useNavStore } from "../../store/navStore";
import type { AppSettings } from "../../types";

const MINI_W = 520;
const MINI_H = 420;

interface Props {
  settings: AppSettings | null;
  onSettingsChange: (s: AppSettings) => void;
}

const VIEW_MAP: Record<string, () => JSX.Element> = {
  artists: () => <ArtistView />,
  albums: () => <AlbumView />,
  songs: () => <AllSongsView />,
  rated: () => <RatedView />,
  recent: () => <RecentView />,
};

export function AppLayout({ settings, onSettingsChange }: Props) {
  const { isScanning } = useLibraryStore();
  const { view, setView } = useNavStore();
  const [winSize, setWinSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  const [isFullscreenPlayer, setIsFullscreenPlayer] = useState(false);

  useEffect(() => {
    const onResize = () =>
      setWinSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMini = winSize.w < MINI_W || winSize.h < MINI_H;

  // No key needed — RainGlass singleton handles its own lifecycle
  if (isMini) return <MiniPlayer />;

  const ContentView = VIEW_MAP[view] ?? VIEW_MAP.artists;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg-base)",
      }}
    >
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          currentView={view}
          onViewChange={setView}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <ContentView />
        </main>
      </div>
      <PlayerBar onFullscreen={() => setIsFullscreenPlayer(true)} />
      {!isFullscreenPlayer && <WindowControls />}
      {isFullscreenPlayer && (
        <FullscreenPlayer onClose={() => setIsFullscreenPlayer(false)} />
      )}
      {isScanning && <ScanningOverlay />}
    </div>
  );
}
