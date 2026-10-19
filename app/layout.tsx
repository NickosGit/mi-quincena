import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mi Quincena · Cuánto debes en cada quincena",
  description:
    "Sube la captura de tu calendario de pagos a meses y ve cuánto debes en cada quincena, sumando todas tus apps.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f2a44",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col text-base">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-10">{children}</div>
      </body>
    </html>
  );
}
