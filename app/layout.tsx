import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Danube Dragons Attendance",
  description: "Interne Attendance App für die Danube Dragons",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
