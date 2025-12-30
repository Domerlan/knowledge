/** @type {import('next').NextConfig} */
const apiProxyUrl = process.env.API_PROXY_URL;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!apiProxyUrl) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
