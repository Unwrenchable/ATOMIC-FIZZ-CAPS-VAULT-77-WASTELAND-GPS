import { BackendStatus } from "@/components/BackendStatus";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <BackendStatus />
      </body>
    </html>
  );
}
