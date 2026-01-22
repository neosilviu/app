/**
 * BUSINESS LOGIC - SSOT în Frontend
 * 100% din REGISTRY - ZERO hardcoding
 */

let _registry: any = null;

export function initRegistry(registry: any) {
  _registry = registry;
}

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
  const actualTiers = tiers || _registry?.PRINTING_CONFIG?.bwTiers || [];
  if (!actualTiers || !Array.isArray(actualTiers) || actualTiers.length === 0) return 0;

  const tier = actualTiers.find((t) => pages <= t.maxPages) || actualTiers[actualTiers.length - 1];
  if (!tier) return 0;

  return full ? (tier.priceFull || 0) : (tier.priceNormal || 0);
}

export function calculateJobPrice(job: any, prices: any): number {
  const actualPrices = prices || _registry?.PRINTING_CONFIG || {};
  if (!actualPrices || !job) return 0;

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
    isA3 ? actualPrices.bwA3Tiers : actualPrices.bwTiers,
    isFullCoverage
  );

  const colorPrice = getTierPrice(
    numPages,
    isA3 ? actualPrices.colorA3Tiers : actualPrices.colorTiers,
    isFullCoverage
  );

  const bindingPrice = isBound ? findTierPrice(numPages, actualPrices.bindingTiers) : 0;

  const cardboardPrice = isCardboard
    ? isA3
      ? findTierPrice(numPages, actualPrices.cardboardA3Tiers)
      : findTierPrice(numPages, actualPrices.cardboardA4Tiers)
    : 0;

  return (
    (pagesColor * colorPrice + pagesBW * bwPrice + bindingPrice + cardboardPrice) * copies
  );
}

export function findTierPrice(pages: number, tiers?: PriceTier[]): number {
  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) return 0;
  const tier = tiers.find((t) => pages <= t.maxPages) || tiers[tiers.length - 1];
  return tier ? (tier.price || 0) : 0;
}

export const BUSINESS_LOGIC = {
  getTierPrice,
  calculateJobPrice,
  findTierPrice,
};
