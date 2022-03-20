import { Html, Head, Main, NextScript } from 'next/document';

// this should be identical to what is auto-generated on the docs page to allow for cps to be properly configured
const scriptTag = `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}if(window.location.hostname!=='localhost'){gtag('js', new Date());gtag('config', 'G-GZJ9QQTK44');}`;

export default function Document() {
  return (
    <Html>
      <Head>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=G-GZJ9QQTK44`} />
        <script
          dangerouslySetInnerHTML={{
            __html: scriptTag,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
