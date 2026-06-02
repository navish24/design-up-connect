import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Designup Connect — Dashboard",
  description: "Designup Connect platform for brands and exhibition organisers",
};

// Runs synchronously before React hydrates — reads localStorage and sets
// data-theme on <html> so the page never flickers between dark and light.
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('dc-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning style={{ height: "100%" }}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
        {children}
      </body>
    </html>
  );
}
