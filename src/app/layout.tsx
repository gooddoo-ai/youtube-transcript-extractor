import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube 스크립트 추출기",
  description: "유튜브 영상의 자막을 텍스트로 추출해드립니다",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
