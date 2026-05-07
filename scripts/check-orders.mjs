import { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io';

const client = new ThetanutsClient({
  chainId: 8453,
  provider: new ethers.JsonRpcProvider(RPC_URL),
});

const orders = await client.api.fetchOrders();
const now = Math.floor(Date.now() / 1000);
const active = orders.filter((o) => Number(o.order.expiry) > now);

console.log(`Total orders: ${orders.length}`);
console.log(`Active orders: ${active.length}`);
console.log('---');

const config = client.chainConfig;
const breakdown = {};
const assetBreakdown = {};
for (const o of active) {
  const impl = o.rawApiData?.implementation?.toLowerCase();
  const info = impl ? config.optionImplementations[impl] : null;
  const name = info?.name ?? 'UNKNOWN';
  breakdown[name] = (breakdown[name] || 0) + 1;
  const feed = o.rawApiData?.priceFeed?.toLowerCase() ?? '';
  let asset = 'UNKNOWN';
  for (const [sym, addr] of Object.entries(config.priceFeeds)) {
    if (addr.toLowerCase() === feed) asset = sym;
  }
  assetBreakdown[asset] = (assetBreakdown[asset] || 0) + 1;
}
console.log('By implementation:', breakdown);
console.log('By asset:', assetBreakdown);

console.log('---first 3 orders---');
for (const o of active.slice(0, 3)) {
  console.log({
    maker: o.order.maker.slice(0, 10),
    expiry: new Date(Number(o.order.expiry) * 1000).toISOString(),
    impl: o.rawApiData?.implementation,
    isCall: o.rawApiData?.isCall,
    strikes: o.rawApiData?.strikes,
    price: o.order.price.toString(),
    available: o.availableAmount.toString(),
  });
}
