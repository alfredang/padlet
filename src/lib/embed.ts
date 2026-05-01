export type Embed =
  | { type: "youtube"; videoId: string; url: string }
  | { type: "vimeo"; videoId: string; url: string }
  | { type: "image"; url: string }
  | { type: "link"; url: string }
  | null;

export function detectEmbed(url: string | null | undefined): Embed {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return { type: "youtube", videoId: v, url };
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/")[2];
      if (id) return { type: "youtube", videoId: id, url };
    }
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id) return { type: "youtube", videoId: id, url };
  }

  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return { type: "vimeo", videoId: id, url };
  }

  if (/\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?|$)/i.test(u.pathname)) {
    return { type: "image", url };
  }

  return { type: "link", url };
}

export function youtubeEmbedUrl(videoId: string) {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function vimeoEmbedUrl(videoId: string) {
  return `https://player.vimeo.com/video/${videoId}`;
}
