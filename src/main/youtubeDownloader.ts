/**
 * Downloads audio from a YouTube link, tags it, and drops it straight into
 * the user's music library using the same Artist/Album folder convention
 * the scanner/organizer already uses (see scanner.ts).
 *
 * Two external binaries are required and are handled transparently:
 *  - yt-dlp   → downloaded once into userData/bin on first use (see below).
 *               We talk to the yt-dlp CLI directly instead of going through
 *               a wrapper package — see the note above ensureYtDlpBinary().
 *  - ffmpeg   → bundled via the `ffmpeg-static` package, no install needed
 */
import { app } from "electron";
import {
  existsSync,
  mkdirSync,
  chmodSync,
  renameSync,
  copyFileSync,
  unlinkSync,
  writeFileSync,
  readdirSync,
} from "fs";
import { join, extname, sep } from "path";
import { randomUUID } from "crypto";
import { spawn, execFile, execSync } from "child_process";
import { promisify } from "util";
import ffmpegPathRaw from "ffmpeg-static";
import NodeID3 from "node-id3";
import { sanitizeFolderName, getUniquePath } from "./scanner";

const execFileAsync = promisify(execFile);

const YOUTUBE_URL_RE =
  /^(https?:\/\/)?(www\.|music\.|m\.)?(youtube\.com\/(watch\?.*v=|shorts\/|embed\/|live\/|playlist\?)|youtu\.be\/)[\w-]+/i;

const PLAYLIST_ID_RE = /[?&]list=([\w-]+)/;

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];

export interface YoutubeVideoInfo {
  videoTitle: string;
  uploader: string;
  durationSeconds: number;
  thumbnailDataUrl: string | null;
  suggestedTitle: string;
  suggestedArtist: string;
}

export interface YoutubeDownloadRequest {
  url: string;
  title: string;
  artist: string;
  album: string;
  musicPath: string;
}

export interface YoutubeDownloadProgress {
  downloadId: string;
  stage: "downloading" | "tagging";
  percent: number;
  speed?: string;
  eta?: string;
}

export type YoutubeDownloadResult =
  | { success: true; filePath: string; relativePath: string }
  | { success: false; error: string; canceled?: boolean };

export interface YoutubePlaylistEntry {
  url: string;
  videoTitle: string;
  uploader: string;
  durationSeconds: number;
  suggestedTitle: string;
  unavailable: boolean;
}

export interface YoutubePlaylistInfo {
  playlistTitle: string;
  suggestedArtist: string;
  entries: YoutubePlaylistEntry[];
}

export interface YoutubePlaylistTrackRequest {
  url: string;
  title: string;
  trackNumber: number;
}

export interface YoutubePlaylistDownloadRequest {
  artist: string;
  album: string;
  musicPath: string;
  tracks: YoutubePlaylistTrackRequest[];
}

export interface YoutubePlaylistDownloadProgress {
  downloadId: string;
  currentIndex: number; // 1-based
  total: number;
  currentTitle: string;
  stage: "downloading" | "tagging";
  percent: number; // progress of the current track only
  speed?: string;
  eta?: string;
}

export interface YoutubePlaylistTrackResult {
  title: string;
  success: boolean;
  error?: string;
}

export interface YoutubePlaylistDownloadResult {
  canceled: boolean;
  results: YoutubePlaylistTrackResult[];
}

// ── yt-dlp binary bootstrap ───────────────────────────────────────────────────
//
// yt-dlp ships as a self-contained per-platform executable (no Python
// required) and is downloaded once into userData/bin on first use, then
// reused. We drive it directly with child_process rather than through a
// wrapper package: the obvious npm option (`yt-dlp-wrap`) is deprecated
// upstream ("Package no longer supported", all published versions), and
// its own binary-fetch logic actually reaches for the wrong asset on
// macOS/Linux — the plain `yt-dlp` file, which is a Python zipapp that
// silently fails to run on machines without Python installed. The pieces
// we actually need (spawn it, read `--dump-json`, parse `[download] NN%`
// progress lines, kill the process tree on cancel) are small enough that
// owning them directly is more reliable than depending on a single
// unmaintained wrapper for them.
let ytDlpBinaryPromise: Promise<string> | null = null;

function getBinDir(): string {
  const dir = join(app.getPath("userData"), "bin");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Packaged Electron apps run out of app.asar, which native/executable
 * binaries cannot run from directly. electron-builder unpacks such files
 * into a sibling app.asar.unpacked folder — this resolves to that path
 * when present, and is a no-op in dev.
 */
function resolveAsarUnpacked(path: string): string {
  const marker = `${sep}app.asar${sep}`;
  if (path.includes(marker)) {
    const unpacked = path.replace(marker, `${sep}app.asar.unpacked${sep}`);
    if (existsSync(unpacked)) return unpacked;
  }
  return path;
}

/**
 * Maps to yt-dlp's own standalone release asset names (verified against
 * yt-dlp/yt-dlp's release workflow) — the PyInstaller-bundled executables
 * that need no system Python, not the plain `yt-dlp` zipapp.
 */
function resolveYtDlpAssetName(): string {
  const { platform, arch } = process;
  if (platform === "win32") return arch === "arm64" ? "yt-dlp_arm64.exe" : "yt-dlp.exe";
  if (platform === "darwin") return "yt-dlp_macos"; // universal2: Intel + Apple Silicon
  if (platform === "linux") return arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
  throw new Error(`Unsupported platform for yt-dlp: ${platform}`);
}

async function downloadYtDlpBinary(destPath: string): Promise<void> {
  const assetName = resolveYtDlpAssetName();
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Couldn't download yt-dlp (HTTP ${res.status}). Check your internet connection and try again.`,
    );
  }
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
}

async function ensureYtDlpBinary(): Promise<string> {
  if (!ytDlpBinaryPromise) {
    ytDlpBinaryPromise = (async () => {
      const isWin = process.platform === "win32";
      const binaryPath = join(getBinDir(), isWin ? "yt-dlp.exe" : "yt-dlp");
      if (!existsSync(binaryPath)) {
        await downloadYtDlpBinary(binaryPath);
        if (!isWin) chmodSync(binaryPath, 0o755);
      }
      return binaryPath;
    })();
    // Don't cache a rejected bootstrap — let the next attempt retry cleanly
    // (e.g. after a transient network failure on first run).
    ytDlpBinaryPromise.catch(() => {
      ytDlpBinaryPromise = null;
    });
  }
  return ytDlpBinaryPromise;
}

function getFfmpegPath(): string {
  if (!ffmpegPathRaw) {
    throw new Error(
      "ffmpeg binary not found. Try reinstalling dependencies (npm install).",
    );
  }
  return resolveAsarUnpacked(ffmpegPathRaw);
}

/** Fetches full `--dump-json` metadata for a URL without downloading anything. */
async function getYtDlpJson(binaryPath: string, url: string): Promise<any> {
  const { stdout } = await execFileAsync(
    binaryPath,
    [url, "--dump-json", "--no-playlist", "--no-warnings"],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

const DOWNLOAD_PROGRESS_RE =
  /\[download\]\s+([\d.]+)%\s+of\s+\S+(?:\s+at\s+(\S+))?(?:\s+ETA\s+(\S+))?/;

/** Best-effort: also stops yt-dlp's ffmpeg subprocess, not just yt-dlp itself. */
function killProcessTree(pid: number): void {
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${pid} /T /F`);
    else execSync(`pkill -P ${pid}`);
  } catch {
    /* process already exited, or had no children — either is fine */
  }
}

function runYtDlpDownload(
  binaryPath: string,
  args: string[],
  onProgress: (p: { percent: number; speed?: string; eta?: string }) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binaryPath, args);
    let stderrTail = "";
    let settled = false;

    const onAbort = () => {
      if (proc.pid) killProcessTree(proc.pid);
      proc.kill();
    };
    signal.addEventListener("abort", onAbort);

    proc.stdout.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r|\n/)) {
        const match = line.match(DOWNLOAD_PROGRESS_RE);
        if (match) {
          onProgress({ percent: parseFloat(match[1]), speed: match[2], eta: match[3] });
        }
      }
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString("utf8")).slice(-2000);
    });
    proc.on("error", (err) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      reject(err);
    });
    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      if (code === 0 || signal.aborted) resolve();
      else reject(new Error(`yt-dlp exited with code ${code}${stderrTail ? `\n${stderrTail}` : ""}`));
    });
  });
}

export function isYoutubeUrl(url: string): boolean {
  return YOUTUBE_URL_RE.test(url.trim());
}

export function getPlaylistId(url: string): string | null {
  const match = url.match(PLAYLIST_ID_RE);
  return match ? match[1] : null;
}

/** True for both a bare playlist link and a "watch?v=...&list=..." link. */
export function isPlaylistUrl(url: string): boolean {
  return isYoutubeUrl(url) && !!getPlaylistId(url);
}

// ── Title/artist heuristics ───────────────────────────────────────────────────
// YouTube video titles are messy ("Artist - Song (Official Music Video)").
// This gives a best-effort starting point; the user confirms/edits it before
// anything is downloaded, so an imperfect guess here is never destructive.

const TRAILING_TAG_GROUP =
  /[([][^()[\]]*\b(official|video|audio|lyrics?|visualizer|hd|4k|remaster(?:ed)?|explicit|clean|mv|hq)\b[^()[\]]*[)\]]\s*$/i;

function cleanTitle(raw: string): string {
  let t = raw.trim();
  let prev: string;
  do {
    prev = t;
    t = t.replace(TRAILING_TAG_GROUP, "").trim();
  } while (t !== prev && t.length > 0);
  t = t.replace(/\s*[|•]\s*(official\s*)?(music\s*)?video.*$/i, "").trim();
  return t || raw.trim();
}

function cleanUploaderAsArtist(uploader: string): string {
  return (uploader || "")
    .replace(/\s*-\s*topic$/i, "") // auto-generated "Artist - Topic" channels
    .replace(/vevo$/i, "")
    .trim();
}

export function splitTitleArtist(
  rawTitle: string,
  uploader: string,
): { title: string; artist: string } {
  const cleanedFull = cleanTitle(rawTitle);
  const cleanedUploader = cleanUploaderAsArtist(uploader);

  // Common upload convention: "Artist - Track Title"
  const dashMatch = cleanedFull.match(/^(.{1,60}?)\s+[-–—]\s+(.{1,150})$/);
  if (dashMatch) {
    const [, left, right] = dashMatch;
    const title = cleanTitle(right);
    if (left.trim() && title) return { artist: left.trim(), title };
  }

  return { artist: cleanedUploader || "Unknown Artist", title: cleanedFull };
}

// ── Thumbnail helpers ─────────────────────────────────────────────────────────

async function fetchThumbnailBuffer(url?: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function folderHasImage(dir: string): boolean {
  try {
    return readdirSync(dir).some((f) =>
      IMAGE_EXTS.includes(extname(f).toLowerCase()),
    );
  } catch {
    return false;
  }
}

// ── Metadata lookup ────────────────────────────────────────────────────────────

export async function fetchVideoInfo(url: string): Promise<YoutubeVideoInfo> {
  if (!isYoutubeUrl(url)) {
    throw new Error("That doesn't look like a YouTube link.");
  }

  const binaryPath = await ensureYtDlpBinary();
  const info = await getYtDlpJson(binaryPath, url);

  const videoTitle: string = info.title || "Untitled";
  const uploader: string = info.uploader || info.channel || "";
  const { title, artist } = splitTitleArtist(videoTitle, uploader);

  const thumbBuffer = await fetchThumbnailBuffer(info.thumbnail);
  const thumbnailDataUrl = thumbBuffer
    ? `data:image/jpeg;base64,${thumbBuffer.toString("base64")}`
    : null;

  return {
    videoTitle,
    uploader,
    durationSeconds: Math.round(info.duration || 0),
    thumbnailDataUrl,
    suggestedTitle: title,
    suggestedArtist: artist,
  };
}

/**
 * Lists a playlist's videos in their actual playlist order using yt-dlp's
 * "flat" mode — it lists entries without resolving each video's full info,
 * so even a large playlist comes back in a second or two. Each line of
 * stdout is one JSON object (JSON Lines), not a single JSON array.
 *
 * Per-video `uploader`/`channel` is unreliable in flat mode — YouTube's
 * playlist listing sometimes omits it, so it can come back null even for
 * videos that download fine. The playlist's own `playlist_uploader` /
 * `playlist_channel` field is present on every line and is a more reliable
 * signal for a shared artist name; per-video uploader is kept as a fallback
 * for older yt-dlp builds that don't report it.
 */
const UNAVAILABLE_TITLE_RE = /^\[(private|deleted|unavailable)\s*video\]$/i;

export async function fetchPlaylistInfo(url: string): Promise<YoutubePlaylistInfo> {
  const playlistId = getPlaylistId(url);
  if (!playlistId) {
    throw new Error("That doesn't look like a YouTube playlist link.");
  }

  const binaryPath = await ensureYtDlpBinary();
  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

  const { stdout } = await execFileAsync(
    binaryPath,
    [playlistUrl, "--flat-playlist", "--dump-json", "--no-warnings"],
    { maxBuffer: 50 * 1024 * 1024 },
  );

  let rawEntries = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry && entry.id);

  if (rawEntries.length === 0) {
    throw new Error("This playlist is empty, private, or unavailable.");
  }

  // Belt-and-suspenders: trust yt-dlp's own playlist_index over stream order,
  // when every entry actually reports one.
  if (rawEntries.every((e) => typeof e.playlist_index === "number")) {
    rawEntries = [...rawEntries].sort((a, b) => a.playlist_index - b.playlist_index);
  }

  const entries: YoutubePlaylistEntry[] = rawEntries.map((entry) => {
    const videoTitle: string = entry.title || "Untitled";
    const uploader: string = entry.uploader || entry.channel || "";
    const { title } = splitTitleArtist(videoTitle, uploader);
    // Deleted/private videos still show up as an entry in the playlist
    // listing, but with no duration and a placeholder title — flag them so
    // the UI can leave them unchecked by default instead of queuing a
    // download that's guaranteed to fail.
    const unavailable = !entry.duration && UNAVAILABLE_TITLE_RE.test(videoTitle.trim());
    return {
      url: `https://www.youtube.com/watch?v=${entry.id}`,
      videoTitle,
      uploader,
      durationSeconds: Math.round(entry.duration || 0),
      suggestedTitle: title,
      unavailable,
    };
  });

  const playlistTitle: string =
    rawEntries[0].playlist_title || rawEntries[0].playlist || "YouTube Playlist";

  const playlistOwner: string =
    rawEntries[0].playlist_uploader || rawEntries[0].playlist_channel || "";

  let suggestedArtist = cleanUploaderAsArtist(playlistOwner);

  // Fallback for older yt-dlp builds that don't report playlist_uploader:
  // whichever per-video uploader shows up most often.
  if (!suggestedArtist) {
    const uploaderCounts = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.uploader) continue;
      uploaderCounts.set(entry.uploader, (uploaderCounts.get(entry.uploader) || 0) + 1);
    }
    let topUploader = "";
    let topCount = 0;
    for (const [name, count] of uploaderCounts) {
      if (count > topCount) {
        topUploader = name;
        topCount = count;
      }
    }
    suggestedArtist = cleanUploaderAsArtist(topUploader);
  }

  return {
    playlistTitle,
    suggestedArtist: suggestedArtist || "Unknown Artist",
    entries,
  };
}

// ── Download + tag ─────────────────────────────────────────────────────────────

const activeDownloads = new Map<string, AbortController>();

export function cancelYoutubeDownload(downloadId: string): boolean {
  const controller = activeDownloads.get(downloadId);
  if (!controller) return false;
  controller.abort();
  return true;
}

interface SingleTrackRequest {
  url: string;
  title: string;
  artist: string;
  album: string;
  musicPath: string;
  trackNumber?: number;
}

/**
 * Downloads, tags, and places one track. Shared by both the single-video
 * flow and the playlist flow below — the only difference between them is
 * how the AbortController and per-track errors are handled by the caller.
 */
async function downloadSingleTrackInternal(
  request: SingleTrackRequest,
  onProgress: (p: { stage: "downloading" | "tagging"; percent: number; speed?: string; eta?: string }) => void,
  signal: AbortSignal,
): Promise<{ filePath: string; relativePath: string }> {
  const { url, artist, album, musicPath, trackNumber } = request;
  const title = request.title.trim();

  const tempDir = join(app.getPath("temp"), "muze-downloads");
  mkdirSync(tempDir, { recursive: true });
  const tempBase = join(tempDir, randomUUID());
  const tempOutput = `${tempBase}.mp3`;

  try {
    const binaryPath = await ensureYtDlpBinary();
    const ffmpegPath = getFfmpegPath();

    await runYtDlpDownload(
      binaryPath,
      [
        url,
        "-f",
        "bestaudio/best",
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--ffmpeg-location",
        ffmpegPath,
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "-o",
        `${tempBase}.%(ext)s`,
      ],
      (p) => onProgress({ stage: "downloading", percent: p.percent ?? 0, speed: p.speed, eta: p.eta }),
      signal,
    );

    if (!existsSync(tempOutput)) {
      throw new Error("Download finished but the audio file was not found.");
    }

    onProgress({ stage: "tagging", percent: 100 });

    // Mirror the library layout: Artist/Album/Title.mp3, or Artist/Title.mp3
    // for a loose single — the scanner already knows how to organize either.
    const artistFolder = sanitizeFolderName(artist, "Unknown Artist");
    const albumFolder = album ? sanitizeFolderName(album, "") : "";
    const targetDir = albumFolder
      ? join(musicPath, artistFolder, albumFolder)
      : join(musicPath, artistFolder);
    mkdirSync(targetDir, { recursive: true });

    const fileName = `${sanitizeFolderName(title, "Untitled")}.mp3`;
    const finalPath = getUniquePath(join(targetDir, fileName));

    try {
      renameSync(tempOutput, finalPath);
    } catch {
      // Cross-device fallback (temp dir on a different drive than the library)
      copyFileSync(tempOutput, finalPath);
      unlinkSync(tempOutput);
    }

    // Re-fetch the canonical thumbnail for tagging/artwork. Kept independent
    // of the earlier preview fetch so this function has no dependency on
    // renderer-cached data and can be called on its own.
    let thumbBuffer: Buffer | null = null;
    try {
      const info = await getYtDlpJson(binaryPath, url);
      thumbBuffer = await fetchThumbnailBuffer(info.thumbnail);
    } catch {
      /* tagging still proceeds without artwork */
    }

    await NodeID3.Promise.write(
      {
        title,
        artist,
        album: album || undefined,
        trackNumber: trackNumber != null ? String(trackNumber) : undefined,
        image: thumbBuffer
          ? {
              mime: "image/jpeg",
              type: { id: 3 }, // front cover
              description: "Cover",
              imageBuffer: thumbBuffer,
            }
          : undefined,
      },
      finalPath,
    );

    // Also drop a folder-level cover, matching how the library scanner
    // discovers artwork (cover.jpg/artist.jpg) — only if none exists yet,
    // so we never clobber art the user already set.
    if (thumbBuffer && !folderHasImage(targetDir)) {
      writeFileSync(join(targetDir, "cover.jpg"), thumbBuffer);
    }

    return {
      filePath: finalPath,
      relativePath: finalPath.slice(musicPath.length + 1),
    };
  } finally {
    try {
      if (existsSync(tempOutput)) unlinkSync(tempOutput);
    } catch {
      /* best-effort cleanup */
    }
  }
}

export async function downloadYoutubeAudio(
  downloadId: string,
  request: YoutubeDownloadRequest,
  onProgress: (p: Omit<YoutubeDownloadProgress, "downloadId">) => void,
): Promise<YoutubeDownloadResult> {
  const { url, musicPath } = request;
  const title = request.title.trim();
  const artist = request.artist.trim();
  const album = request.album.trim();

  if (!isYoutubeUrl(url)) {
    return { success: false, error: "That doesn't look like a YouTube link." };
  }
  if (!title) return { success: false, error: "Please enter a track title." };
  if (!artist) return { success: false, error: "Please enter an artist name." };
  if (!existsSync(musicPath)) {
    return {
      success: false,
      error: "Music folder not found. Check it in Settings.",
    };
  }

  const controller = new AbortController();
  activeDownloads.set(downloadId, controller);

  try {
    const { filePath, relativePath } = await downloadSingleTrackInternal(
      { url, title, artist, album, musicPath },
      onProgress,
      controller.signal,
    );
    return { success: true, filePath, relativePath };
  } catch (err) {
    if (controller.signal.aborted) {
      return { success: false, error: "Download canceled.", canceled: true };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    activeDownloads.delete(downloadId);
  }
}

/**
 * Downloads a whole playlist sequentially, in playlist order. Each track
 * gets an ID3 track-number tag matching its position in the playlist, so
 * the library's own album view (which sorts by track number, not filename)
 * displays them in the right order instead of alphabetically.
 *
 * One bad video (removed/private/region-locked) doesn't abort the batch —
 * it's recorded as a failure and the rest of the playlist keeps going.
 */
export async function downloadYoutubePlaylist(
  downloadId: string,
  request: YoutubePlaylistDownloadRequest,
  onProgress: (p: Omit<YoutubePlaylistDownloadProgress, "downloadId">) => void,
): Promise<YoutubePlaylistDownloadResult> {
  const { musicPath, tracks } = request;
  const artist = request.artist.trim();
  const album = request.album.trim();

  const failAll = (error: string): YoutubePlaylistDownloadResult => ({
    canceled: false,
    results: tracks.map((t) => ({ title: t.title, success: false, error })),
  });

  if (!artist) return failAll("Please enter an artist name.");
  if (!existsSync(musicPath)) return failAll("Music folder not found. Check it in Settings.");
  if (tracks.length === 0) return { canceled: false, results: [] };

  const controller = new AbortController();
  activeDownloads.set(downloadId, controller);

  const results: YoutubePlaylistTrackResult[] = [];

  try {
    for (let i = 0; i < tracks.length; i++) {
      if (controller.signal.aborted) break;
      const track = tracks[i];

      try {
        await downloadSingleTrackInternal(
          {
            url: track.url,
            title: track.title,
            artist,
            album,
            musicPath,
            trackNumber: track.trackNumber,
          },
          (p) =>
            onProgress({
              currentIndex: i + 1,
              total: tracks.length,
              currentTitle: track.title,
              stage: p.stage,
              percent: p.percent,
              speed: p.speed,
              eta: p.eta,
            }),
          controller.signal,
        );
        results.push({ title: track.title, success: true });
      } catch (err) {
        if (controller.signal.aborted) break;
        results.push({
          title: track.title,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    activeDownloads.delete(downloadId);
  }

  return { canceled: controller.signal.aborted, results };
}
