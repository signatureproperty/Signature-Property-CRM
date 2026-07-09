
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '889826ecda9570b1a561c1722b044e1d.r2.cloudflarestorage.com',
      },
      {
          protocol: 'https',
          hostname: 'lh3.googleusercontent.com',
      },
      {
          protocol: 'https',
          hostname: 'firebasestorage.googleapis.com',
      }
    ],
  },
};

export default nextConfig;
