import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastContainer } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ClerkProvider {...pageProps}>
        <ThemeProvider>
          <Component {...pageProps} />
          <ToastContainer />
        </ThemeProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}
