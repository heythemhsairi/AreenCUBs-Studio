import type { Metadata } from "next";
import { Libre_Franklin, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/provider";
import { ToastProvider } from "@/components/toast";
import { Toaster } from "sonner";

const franklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-franklin",
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
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${franklin.variable} ${notoArabic.variable}`}>
      <head>
        {/* Inline script: apply theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('areencubs.theme');var dark=(m==='dark')||(m!=='light'&&(m!=='system'?true:window.matchMedia('(prefers-color-scheme: dark)').matches));if(!dark)document.documentElement.classList.add('light')}catch(e){}})()`,
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
          toastOptions={{ style: { background: '#0D2D47', border: '1px solid #22506F', color: '#F4FAFF' } }}
        />
      </body>
    </html>
  );
}
