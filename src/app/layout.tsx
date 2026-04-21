import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '마미스캔',
  description: '임산부를 위한 성분 안전 확인 서비스',
  other: {
    'format-detection': 'telephone=no, date=no, address=no, email=no',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-bg-canvas h-full overflow-hidden">
        <div className="mx-auto max-w-md h-full flex flex-col overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
