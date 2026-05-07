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
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center">
      <div className="select-none text-2xl font-bold tracking-tight">
        <span className="text-brand">poly</span>
        <span className="text-ink-900">nuts</span>
      </div>
      <h1 className="mt-8 text-xl font-bold text-ink-900">
        Polynuts isn&apos;t available in your region
      </h1>
      <p className="mt-3 max-w-md text-sm text-ink-600">
        Polynuts is a non-custodial prediction market built on Thetanuts Finance V4.
        Access from {region ? `${region} ` : ''}is restricted while we work through
        regulatory compliance.
      </p>
      <p className="mt-4 max-w-md text-sm text-ink-600">
        If you reached this page in error or are using a VPN, try disabling it
        and refreshing.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="https://thetanuts.finance"
          className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-900 hover:border-ink-400"
        >
          About Thetanuts
        </Link>
      </div>
    </div>
  );
}
