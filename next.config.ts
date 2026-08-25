import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/gestao-de-custos',
  assetPrefix: '/gestao-de-custos/',
  trailingSlash: true,
};

export default nextConfig;

