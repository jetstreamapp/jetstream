import { Body, Button, Container, Head, Heading, Html, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

void React.createElement;

interface TeamInvitationProps {
  baseUrl: string;
  teamId: string;
  teamName: string;
  token: string;
  email: string;
  expiresInDays: number;
}

export function getTeamInviteLink({ baseUrl, teamId, token, email }: Omit<TeamInvitationProps, 'teamName' | 'expiresInDays'>) {
  const url = new URL(`${baseUrl}/redirect`);
  url.searchParams.set('action', 'team-invite');
  url.searchParams.set('email', email);
  url.searchParams.set('teamId', teamId);
  url.searchParams.set('token', token);
  url.searchParams.set('redirectUrl', `/app/teams/invite?teamId=${teamId}&token=${token}`);
  return url.toString();
}

export const TeamInvitation = ({ baseUrl, teamId, teamName, token, email, expiresInDays }: TeamInvitationProps) => {
  const url = new URL(`${baseUrl}/redirect`);
  url.searchParams.set('action', 'team-invite');
  url.searchParams.set('email', email);
  url.searchParams.set('teamId', teamId);
  url.searchParams.set('token', token);
  url.searchParams.set('redirectUrl', `/app/teams/invite?teamId=${teamId}&token=${token}`);
  return (
    <Html>
      <Head />
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <EmailLogo />
          <Heading style={EMAIL_STYLES.codeTitle}>You're invited to join the team "{teamName}" on Jetstream</Heading>

          <Text style={EMAIL_STYLES.codeDescription}>This invitation expires in {expiresInDays} days.</Text>

          <Section style={EMAIL_STYLES.buttonContainer}>
            <Button href={url.toString()} style={EMAIL_STYLES.button}>
              Join your teammates
            </Button>
          </Section>

          <Text style={EMAIL_STYLES.paragraphHeading}>If the button doesn't work, you can copy and paste this link:</Text>
          <Text style={EMAIL_STYLES.paragraph}>{url.toString()}</Text>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default TeamInvitation;

TeamInvitation.PreviewProps = {
  baseUrl: 'https://app.getjetstream.app/app',
  teamId: 'c59f196b-ad03-4586-a388-4bbd396918de',
  token: '2ac581e9-a177-4c16-a057-51bfacb879d0',
  email: 'foo@bar.com',
  expiresInDays: 14,
} as TeamInvitationProps;
