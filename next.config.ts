// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      // مشروع Supabase المحدّد (Public Storage)
      {
        protocol: "https",
        hostname: "tftpjgbnxauldxrnlevb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // أي مشروع Supabase (عام)
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/**",
      },

      // صور داخلية من نفس الدومين
      { protocol: "https", hostname: "elyavya.com", pathname: "/**" },

      // مزودات شائعة

      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      { protocol: "https", hostname: "**.cloudfront.net", pathname: "/**" },

      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      // لو عندك مصادر ثانية فعلها هنا:
      // { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      // { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

module.exports = nextConfig;
