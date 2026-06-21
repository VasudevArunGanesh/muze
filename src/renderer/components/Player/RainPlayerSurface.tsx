import { useEffect, useState } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { useCoverArt } from "../../hooks/useCoverArt";
import { useLibraryStore } from "../../store/libraryStore";
import { useNavStore } from "../../store/navStore";
import { formatDuration } from "../../utils/format";
import { RainGlass } from "./RainGlass";

type Variant = "mini" | "fullscreen";

interface Props {
  variant: Variant;
  onExit?: () => void;
  onExpand?: () => void;
}

export function RainPlayerSurface({ variant, onExit, onExpand }: Props) {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    next,
    prev,
    currentTime,
    duration,
  } = usePlayerStore();
  const { library, selectArtist, selectAlbum } = useLibraryStore();
  const { navigateTo } = useNavStore();
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!onExit) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  const artist = currentSong
    ? (library?.artists.find((a) => a.id === currentSong.artistId) ?? null)
    : null;
  const album = currentSong
    ? (artist?.albums.find((a) => a.id === currentSong.albumId) ?? null)
    : null;

  const albumCover = useCoverArt(album?.coverPath);
  const artistImage = useCoverArt(artist?.imagePath);
  const coverSrc = albumCover ?? artistImage;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isFullscreen = variant === "fullscreen";

  function goToArtist() {
    if (!artist) return;
    selectArtist(artist);
    selectAlbum(null);
    navigateTo("artists");
    onExit?.();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: isFullscreen ? 1000 : 999,
        background: "#0a0e14",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {coverSrc && (
        <div
          style={{
            position: "absolute",
            inset: "-10%",
            backgroundImage: `url(${coverSrc})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(36px) brightness(0.22) saturate(1.6)",
            zIndex: 0,
          }}
        />
      )}

      {coverSrc && (
        <RainGlass backgroundSrc={coverSrc} width={size.w} height={size.h} />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background:
            "linear-gradient(160deg, rgba(20,40,70,0.55) 0%, rgba(5,12,25,0.45) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: isFullscreen ? 52 : 36,
            zIndex: 4,
            WebkitAppRegion: variant === "mini" ? "drag" : "no-drag",
          } as React.CSSProperties & { WebkitAppRegion?: string }
        }
      >
        {onExpand && (
          <WindowAction
            title="Maximize to main window"
            onClick={onExpand}
            style={{ right: 10, top: 8 }}
          >
            <path d="M5 5h14v14H5z" />
          </WindowAction>
        )}
        {onExit && (
          <WindowAction
            title="Exit fullscreen"
            onClick={onExit}
            style={{ right: 18, top: 14 }}
          >
            <path d="M8 8h8v8H8z" />
            <path d="M3 10V3h7" />
            <path d="M14 3h7v7" />
            <path d="M21 14v7h-7" />
            <path d="M10 21H3v-7" />
          </WindowAction>
        )}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 3,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: isFullscreen ? "56px 40px 40px" : "40px 16px 12px",
          gap: isFullscreen ? 22 : 10,
        }}
      >
        <div
          style={{
            width: isFullscreen
              ? "min(320px, 34vmin)"
              : "min(110px, 38vw)",
            height: isFullscreen
              ? "min(320px, 34vmin)"
              : "min(110px, 38vw)",
            borderRadius: isFullscreen ? 12 : 10,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            overflow: "hidden",
            boxShadow:
              "0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
            flexShrink: 0,
            backdropFilter: "blur(2px)",
          }}
        >
          {coverSrc ? (
            <img
              src={coverSrc}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: isFullscreen ? 72 : 32,
                color: "rgba(255,255,255,0.2)",
              }}
            >
              *
            </div>
          )}
        </div>

        <div
          style={{ textAlign: "center", maxWidth: isFullscreen ? 680 : "88%" }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: isFullscreen
                ? "clamp(24px, 4vh, 38px)"
                : "clamp(11px, 2.8vw, 14px)",
              color: "rgba(255,255,255,0.92)",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textShadow: "0 1px 6px rgba(0,0,0,0.8)",
            }}
          >
            {currentSong?.title ?? "Nothing playing"}
          </div>
          {artist && (
            <button
              onClick={goToArtist}
              style={{
                marginTop: isFullscreen ? 8 : 3,
                fontSize: isFullscreen
                  ? "clamp(14px, 2vh, 18px)"
                  : "clamp(10px, 2vw, 12px)",
                color: "rgba(255,255,255,0.45)",
                transition: "color var(--transition)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
                textShadow: "0 1px 4px rgba(0,0,0,0.6)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--accent)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.45)")
              }
            >
              {artist.name}
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isFullscreen ? 28 : "clamp(10px, 4vw, 20px)",
          }}
        >
          <GlassBtn onClick={prev} large={isFullscreen} title="Previous">
            <svg
              width={isFullscreen ? 28 : 18}
              height={isFullscreen ? 28 : 18}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 6h2v12H6z" />
              <path d="M9.5 12 18 6v12z" />
            </svg>
          </GlassBtn>
          <button
            onClick={togglePlay}
            style={{
              width: isFullscreen ? 72 : "clamp(34px, 9vw, 44px)",
              height: isFullscreen ? 72 : "clamp(34px, 9vw, 44px)",
              borderRadius: "50%",
              background: currentSong
                ? "var(--accent)"
                : "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: currentSong ? "#000" : "rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: currentSong ? "pointer" : "default",
              boxShadow: currentSong ? "0 0 20px var(--accent-dim)" : "none",
              transition: "transform var(--transition)",
              flexShrink: 0,
              backdropFilter: "blur(4px)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isPlaying ? (
              <svg
                width={isFullscreen ? 24 : 13}
                height={isFullscreen ? 24 : 13}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg
                width={isFullscreen ? 24 : 13}
                height={isFullscreen ? 24 : 13}
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ marginLeft: 2 }}
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <GlassBtn onClick={next} large={isFullscreen} title="Next">
            <svg
              width={isFullscreen ? 28 : 18}
              height={isFullscreen ? 28 : 18}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 18v-12l8.5 6z" />
              <path d="M16 6h2v12h-2z" />
            </svg>
          </GlassBtn>
        </div>

        <div
          style={{
            width: isFullscreen ? "min(640px, 72vw)" : "88%",
            display: "flex",
            flexDirection: "column",
            gap: isFullscreen ? 8 : 4,
          }}
        >
          <div
            style={{
              height: isFullscreen ? 5 : 3,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 3,
              cursor: "pointer",
              position: "relative",
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              usePlayerStore
                .getState()
                .seek(((e.clientX - rect.left) / rect.width) * duration);
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--accent)",
                borderRadius: 3,
                transition: "width 0.5s linear",
                boxShadow: "0 0 6px var(--accent-dim)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: isFullscreen ? 12 : 10,
              color: "rgba(255,255,255,0.25)",
            }}
          >
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WindowAction({
  children,
  onClick,
  title,
  style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  style: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={
        {
          position: "absolute",
          width: 32,
          height: 28,
          color: "rgba(255,255,255,0.72)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color var(--transition), background var(--transition)",
          WebkitAppRegion: "no-drag",
          ...style,
        } as React.CSSProperties & { WebkitAppRegion?: string }
      }
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.95)";
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.72)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

function GlassBtn({
  children,
  onClick,
  large,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  large?: boolean;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontSize: large ? 26 : "clamp(13px, 3.5vw, 17px)",
        color: "rgba(255,255,255,0.5)",
        transition: "color var(--transition)",
        lineHeight: 1,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.color = "rgba(255,255,255,0.95)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.color = "rgba(255,255,255,0.5)")
      }
    >
      {children}
    </button>
  );
}
