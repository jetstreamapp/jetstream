import React from 'react';
import homeImage from '../assets/images/jetstream-homepage-image.png';
import Head from 'next/head';
import CallToAction from '../components/CallToAction';
import Footer from '../components/Footer';
import './index.scss';
import NavBar from '../components/NavBar';
import favicon from '../assets/images/favicon.ico';

export const Index = () => {
  return (
    <div>
      <Head>
        <title>Jetstream</title>
        <link rel="icon" type="image/png" href={favicon}></link>
      </Head>
      <div className="relative bg-white overflow-hidden">
        <div className="max-w-screen-xl mx-auto ">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <svg
              className="hidden lg:block absolute right-0 inset-y-0 h-full w-48 text-white transform translate-x-1/2"
              fill="currentColor"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polygon points="50,0 100,0 50,100 0,100" />
            </svg>

            <div className="relative pt-6 px-4 sm:px-6 lg:px-8">
              <NavBar />
            </div>

            <CallToAction />
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <img className="h-56 w-full object-cover sm:h-72 md:h-96 lg:w-full lg:h-full" src={homeImage} alt="Do More" />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
