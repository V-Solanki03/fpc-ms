import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "FPC-MS", description: "FACE Prep Campus management system" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
