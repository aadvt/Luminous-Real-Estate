import type { Metadata } from "next";
import { Space_Grotesk, Manrope, Archivo_Black } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-headline",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luminous Atlas — India Real Estate Risk Map",
  description: "A colorful 3D atlas of housing-bubble risk across Indian cities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${manrope.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className={`${manrope.className} min-h-full flex flex-col`}>{children}</body>
    </html>
  );
}
