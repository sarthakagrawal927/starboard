export default function StarsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex h-svh flex-col bg-background">{children}</div>;
}
