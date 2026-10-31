import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const ibm = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm",
});

export const metadata: Metadata = {
  title: "AudienceIQ — Customer Intelligence",
  description: "AI-Powered Customer Intelligence & Dynamic Audience Platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${ibm.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
