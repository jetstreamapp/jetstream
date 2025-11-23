import { useEffect, useState } from 'react';
import { ROUTES } from '../utils/environment';
import { useUserProfile } from './auth.hooks';

export interface DownloadInfo {
  version: string;
  filename: string;
  downloadUrl: string;
}

interface DownloadState {
  windows?: DownloadInfo;
  macosX64?: DownloadInfo;
  macosArm64?: DownloadInfo;
  isLoading: boolean;
  error?: string;
}

// Cache for downloads - persists across navigation
let downloadCache: { data: DownloadState; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useDesktopDownloads() {
  const userProfile = useUserProfile();
  const [state, setState] = useState<DownloadState>(() => {
    // Initialize with cache if available and user is logged in
    if (userProfile.isLoggedIn && downloadCache && Date.now() - downloadCache.timestamp < CACHE_DURATION) {
      return downloadCache.data;
    }
    // If user is logged in but no cache, start with loading
    // If user is not logged in, start with non-loading state
    return {
      isLoading: userProfile.isLoggedIn,
    };
  });

  useEffect(() => {
    // Only fetch if user is logged in
    if (!userProfile.isLoggedIn) {
      setState({ isLoading: false });
      return;
    }

    // Check cache first
    if (downloadCache && Date.now() - downloadCache.timestamp < CACHE_DURATION) {
      setState(downloadCache.data);
      return;
    }

    const fetchAllDownloads = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

      try {
        const response = await fetch(ROUTES.API.desktop_downloads, {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication required');
          }
          throw new Error('Failed to fetch download links');
        }

        const downloads = await response.json();

        const newState = {
          windows: downloads.windows || undefined,
          macosX64: downloads.macosX64 || undefined,
          macosArm64: downloads.macosArm64 || undefined,
          isLoading: false,
        };

        // Cache the result
        downloadCache = {
          data: newState,
          timestamp: Date.now(),
        };

        setState(newState);
      } catch (error) {
        const errorState = {
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch download links',
        };
        setState(errorState);
      }
    };

    fetchAllDownloads();
  }, [userProfile.isLoggedIn]);

  return state;
}

export function useDetectPlatform() {
  const [platform, setPlatform] = useState<{ os: 'windows' | 'macos' | 'unknown'; arch: 'x64' | 'arm64' }>({
    os: 'unknown',
    arch: 'x64',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();

      let os: 'windows' | 'macos' | 'unknown' = 'unknown';
      let arch: 'x64' | 'arm64' = 'x64';

      if (userAgent.includes('win')) {
        os = 'windows';
      } else if (userAgent.includes('mac')) {
        os = 'macos';

        // Improved ARM detection for Apple Silicon
        // Check for modern Safari on macOS which typically indicates Apple Silicon
        const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
        const macOSVersion = userAgent.match(/mac os x (\d+)[._](\d+)/);

        // Apple Silicon detection strategies:
        // 1. Check for ARM in user agent (rare but sometimes present)
        // 2. Check screen properties that might indicate Apple Silicon
        // 3. Use newer APIs if available
        if (
          userAgent.includes('arm64') ||
          userAgent.includes('apple m1') ||
          userAgent.includes('apple m2') ||
          userAgent.includes('apple m3')
        ) {
          arch = 'arm64';
        } else if (macOSVersion) {
          const majorVersion = parseInt(macOSVersion[1], 10);

          // macOS 11+ with Safari and high screen density often indicates Apple Silicon
          if (majorVersion >= 11 && isSafari && window.devicePixelRatio >= 2) {
            // This is a heuristic - newer macOS with Retina display and Safari
            // More likely to be Apple Silicon, but not guaranteed
            arch = 'arm64';
          }
        }

        // Additional check: try to use the newer navigator.userAgentData API if available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ('userAgentData' in navigator && (navigator as any).userAgentData?.getHighEntropyValues) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigator as any).userAgentData
              .getHighEntropyValues(['architecture'])
              .then((values) => {
                if (values.architecture === 'arm') {
                  setPlatform({ os: 'macos', arch: 'arm64' });
                }
              })
              .catch(() => {
                // Ignore errors, fallback to current detection
              });
          } catch {
            // Ignore errors, fallback to current detection
          }
        }
      }

      setPlatform({ os, arch });
    }
  }, []);

  return platform;
}
