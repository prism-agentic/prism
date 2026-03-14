/*
 * RichText — Renders translated strings with <highlight> tags
 * Supports: <highlight>text</highlight> → styled span
 */
import type { ReactNode } from "react";

interface RichTextProps {
  text: string;
  highlightClass?: string;
}

export function RichText({ text, highlightClass = "text-gradient-mixed" }: RichTextProps): ReactNode {
  const parts = text.split(/(<highlight>.*?<\/highlight>)/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^<highlight>(.*?)<\/highlight>$/);
        if (match) {
          return (
            <span key={i} className={highlightClass}>
              {match[1]}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
