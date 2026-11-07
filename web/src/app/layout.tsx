import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Comfort Number",
  description: "A financial resilience engine: people save to a dollar number, not a number of months.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="topbar">
          <div className="wrap">
            <Link href="/" className="brand">Comfort<span>Number</span></Link>
            <Link href="/" className="navlink">Engine</Link>
            <Link href="/findings" className="navlink">Findings</Link>
          </div>
        </header>
        <main className="wrap" style={{ paddingTop: 20, paddingBottom: 48, width: "100%" }}>{children}</main>
      </body>
    </html>
  );
}
