const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  // fontFamily: 'HelveticaNeue,Helvetica,Arial,sans-serif',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol',
  textAlign: 'center' as const,
};

const logo: React.CSSProperties = {
  margin: '0 auto',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #ddd',
  borderRadius: '5px',
  marginTop: '20px',
  width: '480px',
  maxWidth: '100%',
  margin: '0 auto',
  padding: '5% 3%',
};

const codeTitle: React.CSSProperties = {
  textAlign: 'center' as const,
};

const codeDescription: React.CSSProperties = {
  textAlign: 'center' as const,
};

const codeContainer: React.CSSProperties = {
  background: 'rgba(0,0,0,.05)',
  borderRadius: '4px',
  margin: '16px auto 14px',
  verticalAlign: 'middle',
  width: '280px',
  maxWidth: '100%',
};

const codeStyle: React.CSSProperties = {
  color: '#000',
  display: 'inline-block',
  paddingBottom: '8px',
  paddingTop: '8px',
  margin: '0 auto',
  width: '100%',
  textAlign: 'center' as const,
  letterSpacing: '8px',
};

const buttonContainer: React.CSSProperties = {
  margin: '27px auto',
  width: 'auto',
};

const button: React.CSSProperties = {
  backgroundColor: '#0176d3',
  borderRadius: '4px',
  fontWeight: '400',
  color: '#fff',
  textAlign: 'center' as const,
  padding: '12px 24px',
  margin: '0 auto',
};

const paragraphHeading: React.CSSProperties = {
  color: '#444',
  letterSpacing: '0',
  padding: '0 40px',
  margin: '5px',
  textAlign: 'center' as const,
  fontWeight: '600',
};

const paragraph: React.CSSProperties = {
  color: '#444',
  letterSpacing: '0',
  padding: '0 40px',
  margin: '0',
  textAlign: 'center' as const,
};

const link: React.CSSProperties = {
  color: '#444',
  textDecoration: 'underline',
};

export const EMAIL_STYLES = {
  main,
  logo,
  container,
  codeTitle,
  codeDescription,
  codeContainer,
  codeStyle,
  buttonContainer,
  button,
  paragraphHeading,
  paragraph,
  link,
} as const;
