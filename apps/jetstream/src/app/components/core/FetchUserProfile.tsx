import { UserProfile } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { userProfileState } from '../../app-state';

export interface FetchUserProfileProps {
  onUserProfile: (userProfile: UserProfile) => void;
}

export const FetchUserProfile: FunctionComponent<FetchUserProfileProps> = ({ onUserProfile, children }) => {
  const [userProfile] = useRecoilState<UserProfile>(userProfileState);

  useEffect(() => {
    if (userProfile) {
      onUserProfile(userProfile);
    }
  }, [onUserProfile, userProfile]);

  return <Fragment>{children}</Fragment>;
};

export default FetchUserProfile;
