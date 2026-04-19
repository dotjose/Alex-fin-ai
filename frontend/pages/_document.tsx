import { Html, Head, Main, NextScript } from "next/document";
import { THEME_BOOT_SCRIPT } from "@/lib/themeStorage";

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta
          name="description"
          content="AlexFin.ai — AI-powered financial intelligence for portfolio analysis and retirement planning."
        />
        <meta name="theme-color" content="#F7F9FC" />
      </Head>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
