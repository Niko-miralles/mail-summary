import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import FormaConnectorScript from "next/script";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mail Summary",
  description: "Resúmenes IA de tu Gmail como notificaciones",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MailSum" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-zinc-900">{children}
<FormaConnectorScript id="forma-connector" data-forma-connector="1" src="https://formacms.app/visual-cms.js" strategy="afterInteractive" data-editor="https://formacms.app" data-content="/forma/content.json" data-live="https://formacms.app/api/content?site=habSFLhmoovUEoNqC5wcLxSKp5Y2RLKeobSulrQOPMY" />
</body>
    </html>
  );
}
