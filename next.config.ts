/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ تجاوز أخطاء ESLint أثناء build على Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.salla.sa" },
      { protocol: "https", hostname: "picsum.photos" },
      // { protocol: "https", hostname: "cdn.example.com" }, // احذفها إذا ما تحتاجها
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

module.exports = nextConfig;
