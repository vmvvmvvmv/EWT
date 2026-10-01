import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KT 플라자 대기현황",
  description: "부산 KT 플라자 매장별 실시간 예상 대기시간을 지도에서 확인하세요.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
