import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Paper & Petal — Thoughtful stationery",
    template: "%s | Paper & Petal",
  },
  description:
    "Beautiful stationery, creative essentials, journals, and thoughtfully selected supplies. Shop Paper & Petal in Nepal.",
  metadataBase: new URL(process.env.APP_ORIGIN ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
