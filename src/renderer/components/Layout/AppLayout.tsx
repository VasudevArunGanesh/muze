import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { WindowControls } from "./WindowControls";
import { PlayerBar } from "../Player/PlayerBar";
import { MiniPlayer } from "../Player/MiniPlayer";
import { FullscreenPlayer } from "../Player/FullscreenPlayer";
import { LyricsFullscreen } from "../Player/LyricsFullscreen";
import { ArtistView } from "../Library/ArtistView";
import { AlbumView } from "../Library/AlbumView";
import { AllSongsView } from "../Library/AllSongsView";
import { RatedView } from "../Library/RatedView";
import { RecentView } from "../Library/RecentView";
import { ScanningOverlay } from "./ScanningOverlay";
import { YoutubeDownloadModal } from "../Download/YoutubeDownloadModal";
import { useLibraryStore } from "../../store/libraryStore";
import { useLyricsStore } from "../../store/lyricsStore";
import { useNavStore } from "../../store/navStore";
import { usePlayerStore } from "../../store/playerStore";
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
  const { isScanning, library } = useLibraryStore();
  const { loadLyrics, clearLyrics } = useLyricsStore();
  const { currentSong, duration } = usePlayerStore();
  const { view, setView } = useNavStore();
  const [winSize, setWinSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  const [isFullscreenPlayer, setIsFullscreenPlayer] = useState(false);
  const [isLyricsFullscreen, setIsLyricsFullscreen] = useState(false);

  useEffect(() => {
    const onResize = () =>
      setWinSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!currentSong) {
      clearLyrics();
      return;
    }

    const artist = library?.artists.find((a) => a.id === currentSong.artistId) ?? null;
    const album = artist?.albums.find((a) => a.id === currentSong.albumId) ?? null;

    if (!artist) return;
    loadLyrics(currentSong, artist, album, duration);
  }, [clearLyrics, currentSong, duration, library, loadLyrics]);

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
      <PlayerBar
        onFullscreen={() => setIsFullscreenPlayer(true)}
        onLyrics={() => setIsLyricsFullscreen(true)}
      />
      {!isFullscreenPlayer && !isLyricsFullscreen && <WindowControls />}
      {isFullscreenPlayer && (
        <FullscreenPlayer onClose={() => setIsFullscreenPlayer(false)} />
      )}
      {isLyricsFullscreen && (
        <LyricsFullscreen onClose={() => setIsLyricsFullscreen(false)} />
      )}
      {isScanning && <ScanningOverlay />}
      <YoutubeDownloadModal musicPath={settings?.musicPath ?? ''} />
    </div>
  );
}
