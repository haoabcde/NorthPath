import type { Metadata, Viewport } from 'next';
import SettingsDialog from '@/components/SettingsDialog';
import '@/index.css';

export const metadata: Metadata = {
  title: 'NorthPath 北极星',
  description: '面向大学生的 AI 简历制作、校准与编辑工作台',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07111F',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <SettingsDialog />
      </body>
    </html>
  );
}

