import { UserProfile } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { userProfileState } from '../../app-state';

export interface FetchUserProfileProps {
  onUserProfile: (userProfile: UserProfile) => void;
}

export const FetchUserProfile: FunctionComponent<FetchUserProfileProps> = ({ onUserProfile, children }) => {
  // FIXME: Cannot update a component (`Batcher`) while rendering a different component (`FetchUserProfile`)
  // Recoil needs to fix this
  const [userProfile] = useRecoilState<UserProfile>(userProfileState);

  useEffect(() => {
    if (userProfile) {
      onUserProfile(userProfile);
    }
  }, [onUserProfile, userProfile]);

  return <Fragment>{children}</Fragment>;
};

export default FetchUserProfile;
