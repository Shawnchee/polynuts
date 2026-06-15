import { redirect } from 'next/navigation';

// /activity is merged into /portfolio — open positions and trade history now
// live on one page. Redirect any old links/bookmarks there.
export default function ActivityPage() {
  redirect('/portfolio');
}
