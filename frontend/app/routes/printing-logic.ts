/**
 * PRINTING BUSINESS LOGIC - Local Domain
 */

export interface PriceTier {
  maxPages: number;
  priceFull?: number;
  priceNormal?: number;
  price?: number;
}

export function getTierPrice(
  pages: number,
  tiers?: PriceTier[],
  full: boolean = false
): number {
  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) return 0;
  const tier = tiers.find((t) => pages <= t.maxPages) || tiers[tiers.length - 1];
  if (!tier) return 0;
  return full ? (tier.priceFull || 0) : (tier.priceNormal || 0);
}

export function calculateJobPrice(job: any, prices: any): number {
  if (!prices || !job) return 0;

  const {
    pagesColor = 0,
    pagesBW = 1,
    copies = 1,
    isA3 = false,
    isCardboard = false,
    isBound = false,
    isFullCoverage = false,
    numPages = 1,
  } = job;

  const bwPrice = getTierPrice(
    numPages,
    isA3 ? prices.bwA3Tiers : prices.bwTiers,
    isFullCoverage
  );

  const colorPrice = getTierPrice(
    numPages,
    isA3 ? prices.colorA3Tiers : prices.colorTiers,
    isFullCoverage
  );

  const findTierP = (p: number, t?: PriceTier[]) => {
    if (!t || !Array.isArray(t) || t.length === 0) return 0;
    const item = t.find((it) => p <= it.maxPages) || t[t.length - 1];
    return item ? (item.price || 0) : 0;
  }

  const bindingPrice = isBound ? findTierP(numPages, prices.bindingTiers) : 0;

  const cardboardPrice = isCardboard
    ? isA3
      ? findTierP(numPages, prices.cardboardA3Tiers)
      : findTierP(numPages, prices.cardboard4Tiers)
    : 0;

  return (
    (pagesColor * colorPrice + pagesBW * bwPrice + bindingPrice + cardboardPrice) * copies
  );
}
