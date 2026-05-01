import { NextResponse } from "next/server";

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, key: string, attr: "property" | "name" = "property") {
  const re1 = new RegExp(
    `<meta\\s[^>]*${attr}\\s*=\\s*["']${key}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta\\s[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*${attr}\\s*=\\s*["']${key}["']`,
    "i"
  );
  const m = html.match(re1) ?? html.match(re2);
  return m ? decodeEntities(m[1]).trim() : null;
}

function absolutize(maybe: string | null, base: string) {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return NextResponse.json({ error: "url query param required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs supported" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PadletPreview/1.0; +https://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return NextResponse.json({ url: target, title: null, description: null, image: null });
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No body");
    let html = "";
    let received = 0;
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const MAX = 256 * 1024;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (received >= MAX) {
        try { await reader.cancel(); } catch {}
        break;
      }
    }
    html += decoder.decode();

    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title", "name") ||
      (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null);

    const description =
      metaContent(html, "og:description") ||
      metaContent(html, "twitter:description", "name") ||
      metaContent(html, "description", "name");

    const imageRaw =
      metaContent(html, "og:image") ||
      metaContent(html, "og:image:url") ||
      metaContent(html, "twitter:image", "name") ||
      metaContent(html, "twitter:image:src", "name");

    return NextResponse.json({
      url: target,
      title: title ? decodeEntities(title).trim().slice(0, 200) : null,
      description: description ? description.slice(0, 400) : null,
      image: absolutize(imageRaw, target),
    });
  } catch (e: any) {
    clearTimeout(timeout);
    return NextResponse.json(
      { url: target, title: null, description: null, image: null, error: e?.message || "fetch failed" },
      { status: 200 }
    );
  }
}
