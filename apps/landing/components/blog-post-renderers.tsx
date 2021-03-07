import { documentToReactComponents, Options } from '@contentful/rich-text-react-renderer';
import { BLOCKS, Document, MARKS } from '@contentful/rich-text-types';
import { Asset } from 'contentful';
import React, { Fragment } from 'react';
import FigureImg from './FigureImg';

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
            <FigureImg
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
