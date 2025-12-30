import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Burn Rate Calendar",
  description: "Personal budget tracker with Monobank integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full m-0 p-0`}
        style={{ overflow: 'hidden', width: '100vw', maxWidth: '100vw' }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
