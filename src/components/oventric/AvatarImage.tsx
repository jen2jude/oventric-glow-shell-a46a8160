import { useState } from "react";

type Props = {
  src?: string | null;
  alt: string;
  initials: string;
  className?: string;
};

/**
 * Avatar image with skeleton shimmer while loading and smooth fade-in.
 * Falls back to initials only after the image errors or when no src is provided.
 */
export function AvatarImage({ src, alt, initials, className }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return <span className={className}>{initials}</span>;
  }

  return (
    <span className="relative w-full h-full block">
      {!loaded && (
        <span
          aria-hidden
          className="absolute inset-0 bg-white/10 animate-pulse"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}
