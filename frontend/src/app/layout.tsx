import "./globals.css";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { themeBootstrapScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Сокращатель ссылок",
  description: "Самохостящийся сокращатель ссылок",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <Navbar />
        <main className="container mx-auto max-w-3xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
