/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 收斂變體數量以節省 Vercel Image Transformations 額度
    deviceSizes: [640, 1080, 1920],
    imageSizes: [120, 256],
    minimumCacheTTL: 2678400, // 31 天
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
