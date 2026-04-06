import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'images.openfoodfacts.org' },
      { hostname: 'static.openfoodfacts.org' },
    ],
  },
};

export default nextConfig;
