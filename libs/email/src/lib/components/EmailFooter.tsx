import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';

export const EmailFooter = () => {
  return (
    <Section style={{ textAlign: 'center', marginTop: '24px' }}>
      <table style={{ width: '100%' }}>
        {/* <tr style={{ width: '100%' }}>
          <td align="center">
            <Img alt="Jetstream logo" height="42" src="https://react.email/static/logo-without-background.png" />
          </td>
        </tr> */}
        <tr style={{ width: '100%' }}>
          <td align="center">
            <Text
              style={{
                marginBottom: 1,
                fontSize: 14,
                lineHeight: '18px',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Jetstream Solutions LLC
            </Text>
          </td>
        </tr>
        <tr>
          <td align="center">
            <Text
              style={{
                marginTop: 0,
                marginBottom: 1,
                fontSize: 12,
                lineHeight: '18px',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
              }}
            >
              Whitefish, MT USA
            </Text>
            <Link
              href="mailto:support@getjetstream.app"
              style={{
                marginTop: 0,
                marginBottom: '0px',
                fontSize: 12,
                lineHeight: '18px',
                fontWeight: 600,
                color: '#009aff',
              }}
            >
              support@getjetstream.app
            </Link>
          </td>
        </tr>
      </table>
    </Section>
  );
};
