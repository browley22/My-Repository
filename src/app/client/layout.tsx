import ClientTopNav from "./ClientTopNav";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ClientTopNav />
      {children}
    </>
  );
}
