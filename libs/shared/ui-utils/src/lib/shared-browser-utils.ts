import Bowser from 'bowser';

const browserMap = new Map<
  string,
  {
    browserName: string;
    browserVersion: string;
    osName: string;
  }
>();

export function getBrowserInfo(userAgent: string) {
  if (browserMap.has(userAgent)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return browserMap.get(userAgent)!;
  }

  const browser = Bowser.getParser(userAgent);
  const browserInfo = {
    browserName: browser.getBrowserName(),
    browserVersion: browser.getBrowserVersion() || 'unknown',
    osName: browser.getOSName(),
  };

  browserMap.set(userAgent, browserInfo);
  return browserInfo;
}
