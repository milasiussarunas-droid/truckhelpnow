import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diagnostic chat",
  description:
    "Start a truck diagnostic session. Describe symptoms, paste fault codes (SPN/FMI), or upload dashboard or scan tool photos. Get structured next steps and suggested checks.",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
