import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"AGMT APEX | Global Market Trader", description:"AGMT APEX market analysis and demo trading terminal." };
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en"><body>{children}</body></html>;
}