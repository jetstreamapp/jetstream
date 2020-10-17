import React from 'react';
import Head from 'next/head';
// import LandingPage from '../components/early-access/LandingPage';
import Footer from '../components/Footer';
import NavBar from '../components/NavBar';
import favicon from '../assets/images/favicon.ico';

export const Index = () => {
  return (
    <div>
      <Head>
        <title>Jetstream</title>
        <link rel="icon" type="image/png" href={favicon}></link>
      </Head>

      <div>
        <div className="relative py-3 px-4 sm:px-6 lg:px-8">
          <NavBar />
        </div>
        {/* <LandingPage /> */}
      </div>

      <Footer currPage="home" />
    </div>
  );
};

export default Index;
