import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Schibsted_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const text = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Any-Buddy Admin", template: "%s · Any-Buddy Admin" },
  description: "Run Any-Buddy: Buddies, bookings, payouts and the service catalog.",
  icons: { icon: "/mark.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#24345f" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en-US" className={text.variable} suppressHydrationWarning>
      <head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: `try{var d=document.documentElement,t=localStorage.getItem("ab_theme"),s=localStorage.getItem("ab_side");if(t)d.dataset.theme=t;if(s)d.dataset.side=s}catch(e){}` }} /></head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
