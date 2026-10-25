import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import "./globals.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });

export const metadata: Metadata = {
  title: "Pawfolio",
  description: "כל המידע על הכלב במקום אחד: חיסונים, אוכל, ביטוח ועלויות",
  appleWebApp: { capable: true, title: "Pawfolio", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Suspense fallback={<Spinner />}>{children}</Suspense>
      </body>
    </html>
  );
}
