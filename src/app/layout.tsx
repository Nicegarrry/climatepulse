import type { Metadata } from "next";
import { Crimson_Pro, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { AuthProvider } from "@/lib/auth-context";
import { DevLoggerProvider } from "@/lib/dev-logger";
import "./globals.css";

const crimsonPro = Crimson_Pro({
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
});

const sourceSans3 = Source_Sans_3({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "climatepulse",
  description: "Climate & energy intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${crimsonPro.variable} ${sourceSans3.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <AuthProvider>
            <DevLoggerProvider>{children}</DevLoggerProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
