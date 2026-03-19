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

const LOGO_URL = 'https://hissuno.com/logos/hissuno/light-mode-transparant.png'

interface WelcomeEmailProps {
  fullName?: string | null
  dashboardUrl: string
}

export function WelcomeEmail({ fullName, dashboardUrl }: WelcomeEmailProps) {
  const greeting = fullName ? `Hi ${fullName}!` : 'Welcome!'

  return (
    <Html>
      <Head />
      <Preview>Welcome to Hissuno - The unified context layer for product agents</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img src={LOGO_URL} alt="Hissuno" width={64} height={64} style={logo} />
          </Section>

          <Heading style={h1}>{greeting}</Heading>

          <Text style={text}>
            Thanks for joining Hissuno! We&apos;re thrilled to have you on board.
          </Text>

          <Text style={text}>
            You&apos;re all set to start turning customer conversations into shipped features
            &mdash; let&apos;s make every conversation count.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              Get Started
            </Button>
          </Section>

          <Text style={subheading}>Here&apos;s what you can do:</Text>
          <table style={featureTable} cellPadding={0} cellSpacing={0}>
            <tr>
              <td style={featureIcon}>&#127919;</td>
              <td style={featureText}>Deploy the Hissuno Agent powered by your product knowledge</td>
            </tr>
            <tr>
              <td style={featureIcon}>&#9889;</td>
              <td style={featureText}>Automatically create and triage issues from customer feedback</td>
            </tr>
            <tr>
              <td style={featureIcon}>&#128161;</td>
              <td style={featureText}>Get actionable insights from every conversation</td>
            </tr>
          </table>

          <Hr style={hr} />

          <Text style={footer}>
            Questions? Just reply to this email &mdash; we&apos;d love to hear from you.
          </Text>

          <Link href={dashboardUrl} style={footerLink}>
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

const subheading = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '24px',
  margin: '0 0 12px',
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

const featureTable = {
  width: '100%',
  margin: '0 0 8px',
}

const featureIcon = {
  fontSize: '18px',
  width: '32px',
  verticalAlign: 'top' as const,
  paddingTop: '2px',
  paddingBottom: '10px',
}

const featureText = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '22px',
  paddingBottom: '10px',
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

export default WelcomeEmail
