import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  allowedDevHosts: [
    'patriotically-nonforeclosing-natasha.ngrok-free.dev',
  ],
  images: {
    remotePatterns: [
      { hostname: 'images.openfoodfacts.org' },
      { hostname: 'static.openfoodfacts.org' },
      { hostname: 'apis.data.go.kr' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
