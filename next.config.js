/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  basePath: process.env.DEPLOY_TARGET === 'standalone' ? '' : '/campus-delivery',
  assetPrefix: process.env.DEPLOY_TARGET === 'standalone' ? '' : '/campus-delivery/',
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: true,
}

module.exports = nextConfig
