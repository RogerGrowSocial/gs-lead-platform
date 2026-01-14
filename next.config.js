/** @type {import('next').NextConfig} */
// This file exists to prevent Vercel from auto-detecting Next.js
// This is an Express.js application, not a Next.js app
module.exports = {
  // Disable Next.js entirely
  output: 'export',
  // Don't build anything - this is an Express app
  distDir: '.next-disabled',
  // Disable all Next.js features
  reactStrictMode: false,
  swcMinify: false,
  // Explicitly tell Vercel this is not a Next.js project
  experimental: {
    outputFileTracingExcludes: {
      '*': ['**/*'],
    },
  },
  // Disable all pages and API routes
  pageExtensions: [],
}
