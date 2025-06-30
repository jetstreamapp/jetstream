import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components';
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

export const TeamInvitation = ({
  baseUrl = 'https://getjetstream.app',
  teamId,
  teamName,
  token,
  email,
  expiresInDays,
}: TeamInvitationProps) => {
  const link = `${baseUrl}/team/join?teamId=${teamId}&token=${token}&teamName=${encodeURIComponent(teamName)}&email=${encodeURIComponent(
    email
  )}`;
  return (
    <Html>
      <Head />
      <Preview>You're invited to join the team "{teamName}" on Jetstream!</Preview>
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <EmailLogo />
          <Heading style={EMAIL_STYLES.codeTitle}>You're invited to join the team "{teamName}" on Jetstream</Heading>

          <Text style={EMAIL_STYLES.codeDescription}>
            This invitation to join "{teamName}" expires in {expiresInDays} days.
          </Text>

          <Section style={EMAIL_STYLES.buttonContainer}>
            <Button href={link} style={EMAIL_STYLES.button}>
              Join your teammates
            </Button>
          </Section>

          <Text style={EMAIL_STYLES.paragraphHeading}>If the button doesn't work, you can copy and paste this link:</Text>
          <Text style={EMAIL_STYLES.paragraph}>{link}</Text>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default TeamInvitation;

TeamInvitation.PreviewProps = {
  teamId: 'c59f196b-ad03-4586-a388-4bbd396918de',
  token: '2ac581e9-a177-4c16-a057-51bfacb879d0',
  email: 'foo@bar.com',
  expiresInDays: 14,
} as TeamInvitationProps;
