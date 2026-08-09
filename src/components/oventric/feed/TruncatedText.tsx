import { useEffect, useRef, useState } from "react";

interface TruncatedTextProps {
  text: string;
  lines?: number;
  className?: string;
  seeMoreText?: string;
  seeLessText?: string;
}

export function TruncatedText({
  text,
  lines = 3,
  className = "",
  seeMoreText = "See more",
  seeLessText = "See less",
}: TruncatedTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const measuredRef = useRef(false);

  // Reset measurement whenever the text or line count changes.
  useEffect(() => {
    measuredRef.current = false;
  }, [text, lines]);

  useEffect(() => {
    const el = ref.current;
    if (!el || measuredRef.current) return;
    const clamped = el.scrollHeight > el.clientHeight + 1;
    setIsClamped(clamped);
    measuredRef.current = true;
  }, [text, lines]);

  if (!text) return null;

  return (
    <div className={className}>
      <p
        ref={ref}
        className={`whitespace-pre-wrap break-words ${expanded ? "" : `line-clamp-${lines}`}`}
      >
        {text}
      </p>
      {isClamped && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-[#E5484D] hover:text-emerald-300 focus:outline-none"
        >
          {expanded ? seeLessText : seeMoreText}
        </button>
      )}
    </div>
  );
}
