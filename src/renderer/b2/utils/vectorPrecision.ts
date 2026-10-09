export const multiplyWithPrecision = (value: number, ratio: number) => {
  const product = value * ratio;
  return Number.isFinite(product) ? Number(product.toPrecision(8)) : product;
};
