import { useState, useEffect } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { useCoverArt } from "../../hooks/useCoverArt";
import { useLibraryStore } from "../../store/libraryStore";
import { useNavStore } from "../../store/navStore";
import { formatDuration } from "../../utils/format";
import { RainGlass } from "./RainGlass";

export function MiniPlayer() {
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

  function goToArtist() {
    if (!artist) return;
    selectArtist(artist);
    selectAlbum(null);
    navigateTo("artists");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "#0a0e14",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Layer 0 — blurred cover background (below everything) */}
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

      {/* Layer 1 — RainGlass WebGL effect (sits above blurred bg) */}
      {coverSrc && (
        <RainGlass backgroundSrc={coverSrc} width={size.w} height={size.h} />
      )}

      {/* Layer 2 — atmospheric tint (above rain, below content) */}
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

      {/* Layer 3 — all interactive content */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 16px",
          gap: 10,
        }}
      >
        {/* Cover art */}
        <div
          style={{
            width: "min(110px, 38vw)",
            height: "min(110px, 38vw)",
            borderRadius: 10,
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
                fontSize: 32,
                color: "rgba(255,255,255,0.2)",
              }}
            >
              ♫
            </div>
          )}
        </div>

        {/* Song + artist */}
        <div style={{ textAlign: "center", maxWidth: "88%" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "clamp(11px, 2.8vw, 14px)",
              color: "rgba(255,255,255,0.92)",
              lineHeight: 1.3,
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
                marginTop: 3,
                fontSize: "clamp(10px, 2vw, 12px)",
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

        {/* Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(10px, 4vw, 20px)",
          }}
        >
          <GlassBtn onClick={prev}>⏮</GlassBtn>
          <button
            onClick={togglePlay}
            style={{
              width: "clamp(34px, 9vw, 44px)",
              height: "clamp(34px, 9vw, 44px)",
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
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ marginLeft: 2 }}
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <GlassBtn onClick={next}>⏭</GlassBtn>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "88%",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              height: 3,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 2,
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
                borderRadius: 2,
                transition: "width 0.5s linear",
                boxShadow: "0 0 6px var(--accent-dim)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
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

function GlassBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: "clamp(13px, 3.5vw, 17px)",
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
