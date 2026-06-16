import type { Metadata } from 'next';
import { Hanken_Grotesk, JetBrains_Mono, Sora } from 'next/font/google';
import { AppProviders } from '@/presentation/providers/app-providers';
import './globals.css';

const display = Sora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
});
const body = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Virtual Chips',
  description: 'A virtual betting layer for poker-style games.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="relative">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
