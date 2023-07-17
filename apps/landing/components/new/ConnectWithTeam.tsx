/* eslint-disable @next/next/no-img-element */

const items = [
  {
    image: 'https://res.cloudinary.com/getjetstream/image/upload/v1673822085/public/discord-mark-black_yj4q38.svg',
    title: 'Ask a question',
    subtitle: 'SFXD Discord Community',
    footer: '#vendor-jetstream',
    link: 'https://discord.gg/sfxd',
  },
  {
    image: 'https://res.cloudinary.com/getjetstream/image/upload/v1673804643/public/github-mark_ryp6er.svg',
    title: 'Start a discussion',
    subtitle: 'Github Discussion',
    footer: null,
    link: 'https://github.com/jetstreamapp/jetstream/discussions',
  },
  {
    image: 'https://res.cloudinary.com/getjetstream/image/upload/v1673804643/public/github-mark_ryp6er.svg',
    title: 'File a ticket',
    subtitle: 'Github Issue',
    footer: null,
    link: 'https://github.com/jetstreamapp/jetstream/issues',
  },
  {
    image: 'https://res.cloudinary.com/getjetstream/image/upload/v1673804643/public/github-mark_ryp6er.svg',
    title: 'Contribute to the codebase',
    subtitle: 'Github',
    footer: null,
    link: 'https://github.com/jetstreamapp/jetstream',
  },
] as const;

export const ConnectWithTeam = () => (
  <div className="relative bg-gray-50 pt-16">
    <div className="mx-auto max-w-md px-4 text-center sm:px-6 sm:max-w-3xl lg:px-8 lg:max-w-7xl">
      <h2 className="text-base font-semibold tracking-wider text-cyan-600 uppercase">Community</h2>
      <p className="mt-2 text-2xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">Get involved with the Jetstream community.</p>
    </div>
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mx-auto max-w-md px-4 sm:max-w-3xl lg:px-8 lg:max-w-7xl">
      {items.map(({ image, footer, link, subtitle, title }) => (
        <div
          key={title}
          className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400 hover:bg-gray-50"
        >
          <div className="flex-shrink-0">
            <img className="h-10 w-10" src={image} alt="" />
          </div>
          <div className="min-w-0 flex-1">
            <a href={link} className="focus:outline-none" target="_blank" rel="noreferrer">
              <span className="absolute inset-0" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">{title}</p>
              <p className="truncate text-sm text-gray-500">{subtitle}</p>
              {footer && <p className="truncate text-sm text-gray-400">{footer}</p>}
            </a>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default ConnectWithTeam;
