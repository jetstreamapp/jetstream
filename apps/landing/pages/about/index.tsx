import Layout from '../../components/layouts/Layout';

export default function Page() {
  return (
    <div className="bg-gray-50 py-24 sm:py-32 border-b border-b-gray-200">
      <div className="mx-auto max-w-md px-6 sm:max-w-lg lg:max-w-7xl lg:px-8">
        <h1 className="text-center text-4xl font-bold leading-10 tracking-tight text-gray-900 sm:text-5xl sm:leading-none lg:text-6xl">
          About Jetstream
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xl leading-normal text-gray-500">
          Jetstream is a source-available project created and maintained{' '}
          <a
            href="https://www.linkedin.com/in/p-austin-turner/"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-500 hover:text-cyan-900"
          >
            Austin Turner
          </a>
          .
        </p>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xl leading-normal text-gray-500">
          I created Jetstream as a side project to solve common problems that my co-workers and I faced on a daily basis. Salesforce is an
          amazing platform with a lot of extensibility, but it can be difficult to manage and maintain.
        </p>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xl leading-normal text-gray-500">
          I truly hope that you love Jetstream as much as I do!
        </p>
      </div>
    </div>
  );
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="About | Jetstream" isInverse>
      {page}
    </Layout>
  );
};
