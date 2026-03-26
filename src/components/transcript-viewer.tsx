// Design Ref: §5.3 — 자막 결과 표시
"use client";

import CopyButton from "./copy-button";
import type { TranscriptResponse } from "@/types";

interface TranscriptViewerProps {
  data: TranscriptResponse;
}

export default function TranscriptViewer({ data }: TranscriptViewerProps) {
  return (
    <div className="w-full mt-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">스크립트</span>
        <CopyButton text={data.text} />
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-h-[60vh] overflow-y-auto">
        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          {data.text}
        </p>
      </div>
    </div>
  );
}
