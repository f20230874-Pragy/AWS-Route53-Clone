import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Route 53 - Hosted zones",
  description: "A functional clone of the Amazon Route 53 management console (educational project).",
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%238c4fff'/%3E%3Ctext x='16' y='22' font-size='14' text-anchor='middle' fill='white' font-family='Arial' font-weight='700'%3E53%3C/text%3E%3C/svg%3E" },
};

const themeScript = `try{var t=localStorage.getItem('r53-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
