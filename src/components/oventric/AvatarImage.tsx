import { useState } from "react";
import { User } from "lucide-react";

type Props = {
  src?: string | null;
  alt: string;
  /** Kept for backward compatibility — no longer rendered. */
  initials?: string;
  className?: string;
  /** Override loading strategy. Defaults to "lazy". */
  loading?: "lazy" | "eager";
  /** Hint for the browser's fetch priority. */
  fetchPriority?: "high" | "low" | "auto";
};

/**
 * Neutral avatar surface. Always fills its parent with a flat dark-grey
 * circle so any colored gradient on the wrapper is fully hidden (this
 * eases GPU load on low-end Android and eliminates the "hue tint"
 * scramble on refresh). When there's no image (or it errors), a plain
 * white person icon is shown — never initials.
 */
export function AvatarImage({ src, alt, className, loading = "lazy", fetchPriority }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showImage = !!src && !errored;

  return (
    <span
      className={`relative block w-full h-full overflow-hidden bg-neutral-800 ${className ?? ""}`}
    >
      {/* Skeleton shimmer while the image is still decoding. */}
      {showImage && !loaded && (
        <span aria-hidden className="absolute inset-0 bg-white/5 animate-pulse" />
      )}
      {/* Fallback: plain white person icon on a dark-grey circle, no ring. */}
      {!showImage && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <User className="w-3/5 h-3/5 text-white/85" strokeWidth={1.75} />
        </span>
      )}
      {showImage && (
        <img
          src={src as string}
          alt={alt}
          loading={loading}
          decoding="async"
          {...(fetchPriority ? { fetchpriority: fetchPriority } : {})}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </span>
  );
}
