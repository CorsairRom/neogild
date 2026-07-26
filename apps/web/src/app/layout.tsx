import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/theme-provider";
import { PrivacyProvider } from "@/components/privacy-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Neogild",
  description: "Tracking financiero personal — correos bancarios + cartolas",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script
          id="ng-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className={`${inter.variable} min-h-screen antialiased`}>
        <ThemeProvider>
          <PrivacyProvider>{children}</PrivacyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
