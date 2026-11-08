import { Kaushan_Script, Manrope, Permanent_Marker } from "next/font/google";

// Schriften für beide Root-Layouts (Kundenseiten unter [lang] und Admin).
const display = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const script = Kaushan_Script({ subsets: ["latin"], weight: "400", variable: "--font-script" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const fontVariables = `${display.variable} ${script.variable} ${body.variable}`;
