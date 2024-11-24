const blogPosts = [
  {
    id: 1,
    title: `Using Jetstream's advanced query builder`,
    href: 'https://docs.getjetstream.app/query',
    // date: 'Mar 16, 2020',
    // datetime: '2020-03-16',
    category: { name: 'Documentation' },
    // imageUrl:
    //   'https://images.unsplash.com/photo-1496128858413-b36217c2ce36?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1679&q=80',
    preview:
      'Not only is the query builder great for viewing record data, but is also a great place to view your objects and fields along with a ton of useful information like field API names, picklist values, field dependencies and more.',
    // author: {
    //   name: 'Roel Aufderehar',
    //   imageUrl:
    //     'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    //   href: '#',
    // },
    // readingLength: '6 min',
  },
  {
    id: 2,
    title: `How to use Jetstream's data loader to update data in your org`,
    href: 'https://docs.getjetstream.app/load',
    // date: 'Mar 10, 2020',
    // datetime: '2020-03-10',
    category: { name: 'Documentation' },
    // imageUrl:
    // 'https://images.unsplash.com/photo-1547586696-ea22b4d4235d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1679&q=80',
    preview: `Jetstream's data loader provides a simple and powerful way to update your orgs record data. Jetstream supports multiple file formats and automatically maps the fields in your file with the fields in your org.`,
    // author: {
    //   name: 'Brenna Goyette',
    //   imageUrl:
    //     'https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    //   href: '#',
    // },
    // readingLength: '4 min',
  },
  {
    id: 3,
    title: `Make field level permission changes quickly`,
    href: 'https://docs.getjetstream.app/permissions',
    // date: 'Feb 12, 2020',
    // datetime: '2020-02-12',
    category: { name: 'Documentation' },
    // imageUrl:
    // 'https://images.unsplash.com/photo-1492724441997-5dc865305da7?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1679&q=80',
    preview:
      'Jetstream makes it easy to view and modify object and field level security across many profiles and permission sets for multiple objects. Choose as many profiles, permission sets, and objects as you need to and update permissions quickly across all of them.',
    // author: {
    //   name: 'Daniela Metz',
    //   imageUrl:
    //     'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    //   href: '#',
    // },
    // readingLength: '11 min',
  },
];

export const Learn = () => (
  <div className="relative bg-gray-50 py-16 sm:py-24 lg:py-32">
    <div className="relative">
      <div className="text-center mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:px-8 lg:max-w-7xl">
        <h2 className="text-base font-semibold tracking-wider text-cyan-600 uppercase">Learn</h2>
        <p className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">Helpful Resources</p>
        <p className="mt-5 mx-auto max-w-prose text-xl text-gray-500">
          Check out the{' '}
          <a className="underline" href="https://docs.getjetstream.app" target="_blank" rel="noreferrer">
            Jetstream documentation
          </a>{' '}
          for more information about using Jetstream.
        </p>
      </div>
      <div className="mt-12 mx-auto max-w-md px-4 grid gap-8 sm:max-w-lg sm:px-6 lg:px-8 lg:grid-cols-3 lg:max-w-7xl">
        {blogPosts.map((post) => (
          <div key={post.id} className="flex flex-col rounded-lg shadow-lg overflow-hidden">
            {/* <div className="flex-shrink-0"> */}
            {/* <img className="h-48 w-full object-cover" src={post.imageUrl} alt="" /> */}
            {/* </div> */}
            <div className="flex-1 bg-white p-6 flex flex-col justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-cyan-600">{post.category.name}</p>
                <a href={post.href} target="_blank" className="block mt-2" rel="noreferrer">
                  <p className="text-xl font-semibold text-gray-900">{post.title}</p>
                  <p className="mt-3 text-base text-gray-500">{post.preview}</p>
                </a>
              </div>
              {/* <div className="mt-6 flex items-center">
                <div className="flex-shrink-0">
                  <a href={post.author.href}>
                    <img className="h-10 w-10 rounded-full" src={post.author.imageUrl} alt={post.author.name} />
                  </a>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    <a href={post.author.href} className="hover:underline">
                      {post.author.name}
                    </a>
                  </p>
                  <div className="flex space-x-1 text-sm text-gray-500">
                    <time dateTime={post.datetime}>{post.date}</time>
                    <span aria-hidden="true">&middot;</span>
                    <span>{post.readingLength} read</span>
                  </div>
                </div>
              </div> */}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Learn;
