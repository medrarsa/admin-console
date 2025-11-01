// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },   // ⬅️ جديد
      { protocol: "https", hostname: "cdn.salla.sa" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
};
module.exports = nextConfig;
