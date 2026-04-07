import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevHosts: [
    'patriotically-nonforeclosing-natasha.ngrok-free.dev',
  ],
  images: {
    remotePatterns: [
      { hostname: 'images.openfoodfacts.org' },
      { hostname: 'static.openfoodfacts.org' },
    ],
  },
};

export default nextConfig;
