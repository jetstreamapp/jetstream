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

export const SupportCta = () => (
  <div className="relative bg-gray-900">
    <div className="relative h-56 bg-indigo-600 sm:h-72 md:absolute md:left-0 md:h-full md:w-1/2">
      <img
        className="w-full h-full object-cover"
        src="https://res.cloudinary.com/getjetstream/image/upload/v1634695304/public/website/jetstream-landing-support-cta.jpg"
        alt="Jetstream support"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-600 mix-blend-multiply" />
    </div>
    <div className="relative mx-auto max-w-md px-4 py-12 sm:max-w-7xl sm:px-6 sm:py-20 md:py-28 lg:px-8 lg:py-32">
      <div className="md:ml-auto md:w-1/2 md:pl-10">
        <p className="mt-2 text-white text-3xl font-extrabold tracking-tight sm:text-4xl">We're here to help</p>
        <p className="mt-3 text-lg text-gray-300">Have a question about Jetstream or need support?</p>
        <div className="mt-8 text-white underline"></div>
        <div className="mt-8 grid grid-cols-1 gap-4">
          {items.map(({ image, footer, link, subtitle, title }) => (
            <div
              key={title}
              className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-4 py-3 shadow focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400 hover:bg-gray-50"
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
    </div>
  </div>
);

export default SupportCta;
