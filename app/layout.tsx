import type { Metadata } from "next";
import { Fraunces, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import "./styles.css";
import "./overrides.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--ff-display",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--ff-ui",
});

export const metadata: Metadata = {
  title: "The World Cup Cup",
  description: "Pour, pick, stamp - track your bracket through the 2026 World Cup.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
