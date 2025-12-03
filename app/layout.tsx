import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IFC Presence Viewer",
  description: "Drop an IFC and collaborate with live cursors."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
