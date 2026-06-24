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
      <body>
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          toastOptions={{ style: { background: '#111827', border: '1px solid #263244', color: '#F8FAFC' } }}
        />
      </body>
    </html>
  );
}
