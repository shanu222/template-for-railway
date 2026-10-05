import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "../styles/globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Production Full-Stack SaaS Starter",
  description:
    "A Railway-ready starter with Next.js, Node.js, PostgreSQL, Prisma, Redis, and authentication.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
