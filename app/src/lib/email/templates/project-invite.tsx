import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface ProjectInviteEmailProps {
  projectName: string
  inviterName: string | null
  acceptUrl: string
  isNewUser: boolean
  inviteCode?: string
  signupUrl?: string
}

export function ProjectInviteEmail({
  projectName,
  inviterName,
  acceptUrl,
  isNewUser,
  inviteCode,
  signupUrl,
}: ProjectInviteEmailProps) {
  const logoUrl = 'https://hissuno.com/logos/hissuno/light-mode-transparant.png'
  const inviterDisplay = inviterName || 'A team member'

  return (
    <Html>
      <Head />
      <Preview>You&apos;ve been invited to {projectName} on Hissuno</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img src={logoUrl} alt="Hissuno" width={64} height={64} style={logo} />
          </Section>

          <Heading style={h1}>You&apos;re invited! &#127881;</Heading>

          <Text style={text}>
            {inviterDisplay} has invited you to collaborate on <strong>{projectName}</strong> on Hissuno.
          </Text>

          {isNewUser ? (
            <>
              <Text style={text}>
                Create your Hissuno account to get started:
              </Text>
              <Section style={buttonContainer}>
                <Button style={button} href={signupUrl || acceptUrl}>
                  Create Account &amp; Join Project
                </Button>
              </Section>
              {inviteCode && (
                <Text style={codeText}>
                  Use invite code <strong>{inviteCode}</strong> during signup.
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={text}>
                Click below to join the project:
              </Text>
              <Section style={buttonContainer}>
                <Button style={button} href={acceptUrl}>
                  Join Project
                </Button>
              </Section>
            </>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            If you didn&apos;t expect this invite, you can safely ignore this email.
          </Text>

          <Link href="https://hissuno.com" style={footerLink}>
            hissuno.com
          </Link>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '560px',
  borderRadius: '8px',
}

const logoContainer = {
  textAlign: 'center' as const,
  margin: '0 0 32px',
}

const logo = {
  margin: '0 auto',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '26px',
  fontWeight: '700',
  lineHeight: '34px',
  margin: '0 0 16px',
}

const text = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
}

const codeText = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 16px',
}

const buttonContainer = {
  margin: '28px 0',
}

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '14px 28px',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '28px 0',
}

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '20px',
}

const footerLink = {
  color: '#8898aa',
  fontSize: '14px',
}

export default ProjectInviteEmail
