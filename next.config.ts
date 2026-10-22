import type {NextConfig} from 'next';
import packageJson from './package.json';

const nextConfig: NextConfig = {
  // Carpeta de compilación configurable: permite correr un segundo servidor
  // (p. ej. pruebas con emuladores) sin pisar el .next del `npm run dev` principal.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
