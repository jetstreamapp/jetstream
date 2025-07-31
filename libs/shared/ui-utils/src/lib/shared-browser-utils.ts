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
    return browserMap.get(userAgent)!;
  }

  const browser = Bowser.getParser(userAgent);
  const browserInfo = {
    browserName: browser.getBrowserName(),
    browserVersion: browser.getBrowserVersion(),
    osName: browser.getOSName(),
  };

  browserMap.set(userAgent, browserInfo);
  return browserInfo;
}
