import fetch from "node-fetch";
import { load } from "cheerio";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function looksLikeDirectImage(url) {
  if (!url) return false;
  try {
    const lower = String(url).toLowerCase().split("?")[0].split("#")[0];
    return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  } catch (_) {
    return false;
  }
}

export async function resolveDirectImage(rawUrl) {
  if (!rawUrl) return null;

  // Already looks like an image by extension
  if (looksLikeDirectImage(rawUrl)) return rawUrl;

  try {
    const res = await fetch(rawUrl, { redirect: "follow" });

    const finalUrl = res.url || rawUrl;
    if (looksLikeDirectImage(finalUrl)) return finalUrl;

    const contentType =
      (res.headers &&
        (res.headers.get
          ? res.headers.get("content-type")
          : res.headers["content-type"])) ||
      "";
    if (contentType && contentType.startsWith("image/")) {
      // Final URL served with image content-type — accept it
      return finalUrl;
    }

    // If not HTML, and not an image content-type, give up
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    const $ = load(html);

    // OpenGraph image
    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="og:image"]').attr("content");
    if (ogImage) {
      if (looksLikeDirectImage(ogImage)) return ogImage;
      // follow the og image to see if it resolves to an image
      try {
        const ogRes = await fetch(new URL(ogImage, finalUrl).toString(), {
          redirect: "follow",
        });
        const ogFinal = ogRes.url || ogImage;
        const ogCT =
          (ogRes.headers && ogRes.headers.get
            ? ogRes.headers.get("content-type")
            : "") || "";
        if (
          looksLikeDirectImage(ogFinal) ||
          (ogCT && ogCT.startsWith("image/"))
        )
          return ogFinal;
      } catch (_) {
        /* ignore */
      }
    }

    // Twitter card
    const twitterImage = $('meta[name="twitter:image"]').attr("content");
    if (twitterImage) {
      if (looksLikeDirectImage(twitterImage)) return twitterImage;
      try {
        const tRes = await fetch(new URL(twitterImage, finalUrl).toString(), {
          redirect: "follow",
        });
        const tFinal = tRes.url || twitterImage;
        const tCT =
          (tRes.headers && tRes.headers.get
            ? tRes.headers.get("content-type")
            : "") || "";
        if (looksLikeDirectImage(tFinal) || (tCT && tCT.startsWith("image/")))
          return tFinal;
      } catch (_) {
        /* ignore */
      }
    }

    // First <img> that looks like a direct image
    const imgs = $("img")
      .map((i, el) => $(el).attr("src"))
      .get()
      .filter(Boolean);
    for (const src of imgs) {
      try {
        const candidate = new URL(src, finalUrl).toString();
        if (looksLikeDirectImage(candidate)) return candidate;
        // attempt a HEAD fetch to check content-type quickly
        try {
          const head = await fetch(candidate, {
            method: "HEAD",
            redirect: "follow",
          });
          const hCT =
            (head.headers && head.headers.get
              ? head.headers.get("content-type")
              : "") || "";
          if (hCT && hCT.startsWith("image/")) return candidate;
        } catch (_) {
          /* ignore */
        }
      } catch (_) {
        /* ignore invalid URLs */
      }
    }

    return null;
  } catch (err) {
    // Don't throw — caller expects null when no image found
    // Log minimally to avoid chatty logs
    try {
      console.warn(
        "[Media] resolveDirectImage failed",
        err && err.message ? err.message : String(err),
      );
    } catch (_) {}
    return null;
  }
}

export default resolveDirectImage;
