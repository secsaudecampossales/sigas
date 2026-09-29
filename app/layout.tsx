import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIGAS Saúde — Gestão de Almoxarifado",
  description:
    "Sistema integrado de gestão de almoxarifado da Secretaria Municipal de Saúde.",
};

/**
 * Aplica o tema antes da primeira pintura (sem "flash" claro→escuro):
 * lê `sigas:tema`; sem escolha salva, segue o tema do sistema.
 * Idempotente — pode rodar mais de uma vez sem alternar o estado.
 */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("sigas:tema");var dark=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(dark){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: THEME_INIT }}
        />
        {children}
      </body>
    </html>
  );
}
