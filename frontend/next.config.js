/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    turbopack: {
        root: __dirname,
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'assets.utils.com' },
        ],
    },
}
module.exports = nextConfig
