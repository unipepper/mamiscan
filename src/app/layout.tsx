import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '마미스캔',
  description: '임산부를 위한 성분 안전 확인 서비스',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning className="bg-bg-canvas min-h-screen">
        <div className="mx-auto max-w-md min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
