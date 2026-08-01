import { forwardRef, useEffect, useState, type ImgHTMLAttributes, type SyntheticEvent } from "react";

/**
 * ResponsiveImage — drop-in replacement for <img> that emits srcset/sizes
 * when the source URL is transformable (Supabase Storage render endpoint or
 * Lovable asset CDN with a width query). For arbitrary URLs it falls back to
 * a plain <img> with lazy loading and async decoding.
 */
export interface ResponsiveImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Widths (in CSS px) to emit in srcset. Defaults to a sensible ladder. */
  widths?: number[];
  /** `sizes` attribute (media queries → rendered width). */
  sizes?: string;
}

const DEFAULT_WIDTHS = [320, 480, 640, 960, 1280, 1600];

function buildTransformedUrl(src: string, width: number): string | null {
  // Supabase Storage image transformation endpoint (public or signed render).
  //   /storage/v1/render/image/(public|sign|authenticated)/<bucket>/<path>?...
  if (/\/storage\/v1\/render\/image\//.test(src)) {
    try {
      const u = new URL(src, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      u.searchParams.set("width", String(width));
      u.searchParams.set("resize", "contain");
      u.searchParams.set("quality", "75");
      return u.toString();
    } catch {
      return null;
    }
  }
  // Supabase Storage signed object URLs — rewrite to the render endpoint,
  // which accepts the same signature for image transforms.
  if (/\/storage\/v1\/object\/sign\//.test(src)) {
    try {
      const u = new URL(src);
      u.pathname = u.pathname.replace("/storage/v1/object/sign/", "/storage/v1/render/image/sign/");
      u.searchParams.set("width", String(width));
      u.searchParams.set("resize", "contain");
      u.searchParams.set("quality", "75");
      return u.toString();
    } catch {
      return null;
    }
  }
  return null;
}

function buildSrcSet(src: string, widths: number[]): string | null {
  const parts: string[] = [];
  for (const w of widths) {
    const url = buildTransformedUrl(src, w);
    if (url) parts.push(`${url} ${w}w`);
  }
  return parts.length ? parts.join(", ") : null;
}

export const ResponsiveImage = forwardRef<HTMLImageElement, ResponsiveImageProps>(
  function ResponsiveImage(
    { src, widths = DEFAULT_WIDTHS, sizes = "100vw", loading, decoding, srcSet, ...rest },
    ref,
  ) {
    const computedSrcSet = !srcSet && typeof src === "string" ? buildSrcSet(src, widths) : srcSet ?? undefined;
    return (
      <img
        ref={ref}
        src={src}
        srcSet={computedSrcSet ?? undefined}
        sizes={computedSrcSet ? sizes : undefined}
        loading={loading ?? "lazy"}
        decoding={decoding ?? "async"}
        {...rest}
      />
    );
  },
);

export default ResponsiveImage;
