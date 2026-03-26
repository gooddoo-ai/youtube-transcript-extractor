// Design Ref: §5.3 — 클립보드 복사 + "복사됨" 피드백
"use client";

import { useState } from "react";

interface CopyButtonProps {
  text: string;
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="px-4 py-2 text-sm border border-gray-300 rounded-lg
        hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500
        transition-colors"
    >
      {copied ? "복사됨!" : "📋 복사"}
    </button>
  );
}
