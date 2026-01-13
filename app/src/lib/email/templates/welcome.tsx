import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface WelcomeEmailProps {
  fullName?: string | null
  dashboardUrl: string
}

export function WelcomeEmail({ fullName, dashboardUrl }: WelcomeEmailProps) {
  const greeting = fullName ? `Hi ${fullName}` : 'Welcome'

  return (
    <Html>
      <Head />
      <Preview>Welcome to Hissuno - Your customer intelligence platform</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{greeting}!</Heading>

          <Text style={text}>
            Thanks for signing up for Hissuno. We&apos;re excited to help you transform
            customer conversations into actionable engineering work.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>

          <Text style={text}>With Hissuno, you can:</Text>
          <ul style={list}>
            <li>Deploy an AI support agent powered by your product knowledge</li>
            <li>Automatically create and triage issues from customer feedback</li>
            <li>Get actionable insights from every conversation</li>
          </ul>

          <Hr style={hr} />

          <Text style={footer}>If you have any questions, just reply to this email.</Text>

          <Link href={dashboardUrl} style={footerLink}>
            Hissuno
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
  padding: '40px 20px',
  maxWidth: '560px',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '32px',
  margin: '0 0 20px',
}

const text = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const buttonContainer = {
  margin: '24px 0',
}

const button = {
  backgroundColor: '#1a1a1a',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
}

const list = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  paddingLeft: '20px',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '32px 0',
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
