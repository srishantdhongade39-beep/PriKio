/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/fastapi/:path*',
        destination: 'http://localhost:8000/api/:path*', // Proxy to FastAPI
      },
    ]
  },
}

export default nextConfig
