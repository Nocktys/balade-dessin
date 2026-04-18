import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Le temps d'une Balade",
  description: "Balades à pied avec pause dessin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}