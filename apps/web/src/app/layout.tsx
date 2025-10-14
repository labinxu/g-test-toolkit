import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { SessionProvider } from './context/session-context';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gettr Test Toolkit',
  description: 'Generated to web with mobile testing',
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex-1 antialiased font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionProvider>{children}</SessionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
