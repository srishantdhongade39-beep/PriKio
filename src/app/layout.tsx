import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import LenisProvider from "@/providers/LenisProvider";
import ProgressBarProvider from "@/providers/ProgressBarProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "CampusPrint",
  description: "Official Print Service - Presidency University",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LenisProvider>
          <ProgressBarProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ProgressBarProvider>
        </LenisProvider>
      </body>
    </html>
  );
}
