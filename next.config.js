/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/projects/tasks',
        destination: '/projects/teams?tab=tasks',
        permanent: false,
      },
      {
        source: '/projects/teams',
        has: [{ type: 'query', key: 'tab', value: 'active' }],
        destination: '/projects/teams?tab=teams',
        permanent: false,
      },
      {
        source: '/projects/teams',
        has: [{ type: 'query', key: 'tab', value: 'formation' }],
        destination: '/projects/teams?tab=teams',
        permanent: false,
      },
      {
        source: '/projects/teams',
        has: [{ type: 'query', key: 'tab', value: 'projects' }],
        destination: '/projects/teams?tab=tasks',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig
