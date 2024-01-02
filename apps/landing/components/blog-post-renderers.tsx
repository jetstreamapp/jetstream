/* eslint-disable react/display-name */
import { documentToReactComponents, NodeRenderer, Options } from '@contentful/rich-text-react-renderer';
import { BLOCKS, Document, MARKS } from '@contentful/rich-text-types';
import { Asset } from 'contentful';
import isString from 'lodash/isString';
import { Fragment, ReactNode } from 'react';
// import FigureImg from './FigureImg';
import { LinkIcon } from '@heroicons/react/outline';
import FigureImgWithViewFullScreen from './FigureImgWithViewFullScreen';
const NON_URL_CHARACTERS = /[^a-zA-Z0-9-]/g;

const getNodeText = (node: ReactNode) => {
  if (['string', 'number'].includes(typeof node)) {
    return node;
  }
  if (node instanceof Array) {
    return node.map(getNodeText).join('');
  }
  if (typeof node === 'object' && node) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return getNodeText((node as any).props?.children);
  }
};

// function getSlug(node): string | undefined {
//   try {
//     const text = getNodeText(node) as string;
//     if (isString(text)) {
//       return text.toLowerCase().replace(NON_URL_CHARACTERS, '-');
//     }
//   } catch (ex) {
//     // could not process id
//   }
//   return undefined;
// }

const wrapHeadingWithAnchor = (type: 'heading-1' | 'heading-2' | 'heading-3' | 'heading-4' | 'heading-5' | 'heading-6'): NodeRenderer => {
  return (node, children) => {
    const text = getNodeText(children) as string;
    let slug = '';
    let anchor: JSX.Element | null = null;
    if (isString(text)) {
      slug = text.toLowerCase().replace(NON_URL_CHARACTERS, '-');
    }
    if (slug) {
      anchor = (
        <a href={`#${slug}`} title={text} className="opacity-60 hover:opacity-100 pt-2 pl-1 select-none flex-grow">
          <LinkIcon className="h-5 w-5 stroke-gray-50" aria-hidden="true" />
        </a>
      );
    }
    if (type === 'heading-1') {
      return (
        <h1 id={slug} className="flex flex-row">
          {children} {anchor}
        </h1>
      );
    } else if (type === 'heading-2') {
      return (
        <h2 id={slug} className="flex flex-row">
          {children} {anchor}
        </h2>
      );
    } else if (type === 'heading-3') {
      return (
        <h3 id={slug} className="flex flex-row">
          {children} {anchor}
        </h3>
      );
    } else if (type === 'heading-4') {
      return (
        <h4 id={slug} className="flex flex-row">
          {children} {anchor}
        </h4>
      );
    } else if (type === 'heading-5') {
      return (
        <h5 id={slug} className="flex flex-row">
          {children} {anchor}
        </h5>
      );
    } else if (type === 'heading-6') {
      return (
        <h6 id={slug} className="flex flex-row">
          {children} {anchor}
        </h6>
      );
    }
    return <h1>{children}</h1>;
  };
};

export function renderBlogPostRichText(richText: Document) {
  const options: Options = {
    // TODO: will this work with code blocks?
    renderText: (text) => {
      return text.split('\n').reduce((children, textSegment, index) => {
        return [...children, index > 0 && <br key={index} />, textSegment];
      }, []);
    },
    renderMark: {
      [MARKS.BOLD]: (text) => <strong>{text}</strong>,
      [MARKS.CODE]: (text) => (
        <pre>
          <code>{text}</code>
        </pre>
      ),
      [MARKS.ITALIC]: (text) => <em>{text}</em>,
      [MARKS.UNDERLINE]: (text) => <u>{text}</u>,
    },
    renderNode: {
      hyperlink: (node, children) => (
        <a href={node.data.uri} className="text-blue-700">
          {children}
        </a>
      ),
      [BLOCKS.UL_LIST]: (node, children) => {
        return <ul>{children}</ul>;
      },
      [BLOCKS.OL_LIST]: (node, children) => {
        return <ul>{children}</ul>;
      },
      [BLOCKS.HEADING_1]: wrapHeadingWithAnchor('heading-1'),
      [BLOCKS.HEADING_2]: wrapHeadingWithAnchor('heading-2'),
      [BLOCKS.HEADING_3]: wrapHeadingWithAnchor('heading-3'),
      [BLOCKS.HEADING_4]: wrapHeadingWithAnchor('heading-4'),
      [BLOCKS.HEADING_5]: wrapHeadingWithAnchor('heading-5'),
      [BLOCKS.HEADING_6]: wrapHeadingWithAnchor('heading-6'),
      [BLOCKS.PARAGRAPH]: (node, children) => {
        // <pre> cannot be a descendent of <p>, ensure these have a surrounding div
        if (node.content.some((child) => child.nodeType === 'text' && child.marks.some((mark) => mark.type === 'code'))) {
          return <div>{children}</div>;
        }
        return <p>{children}</p>;
      },
      [BLOCKS.EMBEDDED_ASSET]: (node, children) => {
        try {
          const asset: Asset = node.data.target;
          return (
            <FigureImgWithViewFullScreen
              src={node.data.target.fields.file.url}
              title={asset.fields.title}
              description={asset.fields.description}
              width={asset.fields.file.details.image?.width}
              height={asset.fields.file.details.image?.height}
            />
          );
        } catch (ex) {
          console.warn('[RENDER ASSET ERROR]', ex.message);
          <Fragment />;
        }
      },
    },
  };

  return documentToReactComponents(richText, options);
}
