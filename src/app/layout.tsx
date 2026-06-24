import type { Metadata } from "next";
import { Libre_Franklin } from "next/font/google";
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
    <html lang="fr" className={franklin.variable}>
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
