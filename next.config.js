/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/projects/tasks',
        destination: '/projects/teams?tab=tasks',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
