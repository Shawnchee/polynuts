import Link from 'next/link';

export const metadata = {
  title: 'Polynuts — Not available in your region',
};

export default function NotAvailablePage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const region = searchParams.from?.toUpperCase();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="select-none text-2xl font-bold tracking-tight">
        <span className="text-brand">poly</span>
        <span className="text-text">nuts</span>
      </div>
      <h1 className="mt-8 text-xl font-bold text-text">
        Polynuts isn&apos;t available in your region
      </h1>
      <p className="mt-3 max-w-md text-sm text-text-muted">
        Polynuts is a non-custodial prediction market built on Thetanuts Finance V4.
        Access from {region ? `${region} ` : ''}is restricted while we work through
        regulatory compliance.
      </p>
      <p className="mt-4 max-w-md text-sm text-text-muted">
        If you reached this page in error or are using a VPN, try disabling it
        and refreshing.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="https://thetanuts.finance"
          className="press-scale rounded-md border border-line bg-bg-elev px-4 py-2 text-sm font-medium text-text hover:bg-surface-hover transition-colors"
        >
          About Thetanuts
        </Link>
      </div>
    </div>
  );
}
