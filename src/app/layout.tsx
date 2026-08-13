import type { Metadata } from "next";
import { Manrope, Noto_Sans_Arabic } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/provider";
import { ToastProvider } from "@/components/toast";
import { Toaster } from "sonner";

/**
 * Interface typeface — Manrope, SIL Open Font License.
 *
 * Self-hosted at build time by next/font/google: no runtime request to Google,
 * no paid service, no licence to accept. Chosen over the previous Libre
 * Franklin for the geometry this product wants — closed apertures and a tall
 * x-height keep dense tables legible at 13px, and the semibold has enough
 * weight contrast against regular to carry hierarchy without going up a size.
 *
 * No `weight` array: Manrope is variable (200–800), so omitting it loads the
 * axis once rather than shipping six static cuts.
 */
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

/**
 * Arabic typeface.
 *
 * Noto Sans Arabic under the SIL Open Font License — approved as the free
 * replacement for Ping AR + LT, whose desktop .otf files carry no web-embedding
 * rights and would have required a paid webfont licence. No Ping AR file has
 * been copied, converted or committed.
 *
 * No `weight` array is given on purpose: Noto Sans Arabic is a variable font,
 * and omitting the weights makes next/font load the variable axis (100–900) as
 * a single file rather than one static file per weight.
 *
 * Self-hosted at build time by next/font/google — no runtime request to Google
 * and no third-party connection from the browser.
 */
const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Areen CUBs Studio",
  description: "Internal management workspace for Areen CUBs.",
  icons: {
    icon: "/brand/areen-cubs-icon.svg",
    apple: "/brand/areen-cubs-icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${manrope.variable} ${notoArabic.variable}`}>
      <head>
        {/* Inline script: apply theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('areencubs.theme');var light=!m||m==='light'||(m==='system'&&!window.matchMedia('(prefers-color-scheme: dark)').matches);if(light)document.documentElement.classList.add('light')}catch(e){document.documentElement.classList.add('light')}})()`,
          }}
        />
      </head>
      <body>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          toastOptions={{ style: { background: 'rgb(var(--ac-surface))', border: '1px solid rgb(var(--ac-border))', color: 'rgb(var(--ac-text))' } }}
        />
      </body>
    </html>
  );
}
