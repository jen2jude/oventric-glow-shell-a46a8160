/**
 * Maps a stored social profile URL to a native app deep link (when the app is
 * installed) with a graceful fallback to the normal web URL.
 */
export type SocialKey =
  | "website"
  | "x"
  | "instagram"
  | "linkedin"
  | "github"
  | "youtube"
  | "tiktok"
  | "facebook"
  | "whatsapp"
  | "telegram";

export const SOCIAL_LABELS: Record<SocialKey, string> = {
  website: "Website",
  x: "X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  github: "GitHub",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

/** Last non-empty path segment, usually the handle. */
function handleOf(url: string): string | null {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    return seg ? seg.replace(/^@/, "") : null;
  } catch {
    return null;
  }
}

/** Returns a native app scheme URL for the given social link, if one exists. */
export function nativeSocialUrl(key: string, url: string): string | null {
  const handle = handleOf(url);
  switch (key) {
    case "x":
      return handle ? `twitter://user?screen_name=${encodeURIComponent(handle)}` : null;
    case "instagram":
      return handle ? `instagram://user?username=${encodeURIComponent(handle)}` : null;
    case "tiktok":
      return handle ? `snssdk1233://user/profile/${encodeURIComponent(handle)}` : null;
    case "youtube":
      return `vnd.youtube://${url.replace(/^https?:\/\//, "")}`;
    case "facebook":
      return `fb://facewebmodal/f?href=${encodeURIComponent(url)}`;
    case "linkedin":
      return handle ? `linkedin://in/${encodeURIComponent(handle)}` : null;
    case "telegram":
      return handle ? `tg://resolve?domain=${encodeURIComponent(handle)}` : null;
    case "whatsapp": {
      const digits = url.replace(/\D/g, "");
      return digits ? `whatsapp://send?phone=${digits}` : null;
    }
    default:
      return null;
  }
}

/**
 * Opens the native app when installed, otherwise the web URL. Safe to call
 * from a click handler; always falls back after a short timeout.
 */
export function openSocialLink(key: string, url: string) {
  if (typeof window === "undefined") return;
  const native = nativeSocialUrl(key, url);
  if (!native) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  let didHide = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") didHide = true;
  };
  document.addEventListener("visibilitychange", onHide);

  const timer = window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!didHide) window.open(url, "_blank", "noopener,noreferrer");
  }, 700);

  try {
    window.location.href = native;
  } catch {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onHide);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
