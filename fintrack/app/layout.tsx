import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fintrack — Suivi financier",
  description: "Tableau de bord financier connecté à Notion",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`*{margin:0;padding:0;box-sizing:border-box} body{overflow:hidden}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
