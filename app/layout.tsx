import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://truckhelpnow.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TruckHelpNow – Truck repair & diagnostic help",
    template: "%s | TruckHelpNow",
  },
  description:
    "TruckHelpNow helps drivers and dispatchers turn symptoms and fault codes into clear, safety‑minded next steps.",
  keywords: [
    "truck repair",
    "truck diagnostic",
    "fault codes",
    "SPN FMI",
    "roadside diagnostic",
    "truck breakdown",
    "driver assistance",
  ],
  openGraph: {
    title: "TruckHelpNow – Truck repair & diagnostic help",
    description:
      "TruckHelpNow helps drivers and dispatchers turn symptoms and fault codes into clear, safety‑minded next steps.",
    url: siteUrl,
    siteName: "TruckHelpNow",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TruckHelpNow – Truck repair & diagnostic help",
    description:
      "TruckHelpNow helps drivers and dispatchers turn symptoms and fault codes into clear, safety‑minded next steps.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
