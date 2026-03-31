import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, DM_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { AuthProvider } from "@/lib/auth-context";
import { DevLoggerProvider } from "@/lib/dev-logger";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
});

const dmMono = DM_Mono({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ClimatePulse",
  description: "Climate intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfairDisplay.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
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
