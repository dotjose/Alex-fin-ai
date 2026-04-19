import { Html, Head, Main, NextScript } from "next/document";
import { THEME_BOOT_SCRIPT } from "@/lib/themeStorage";

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta
          name="description"
          content="AlexFin.ai — AI-powered financial intelligence for portfolio analysis and retirement planning."
        />
        <meta name="theme-color" content="#FFFFFF" />
      </Head>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
