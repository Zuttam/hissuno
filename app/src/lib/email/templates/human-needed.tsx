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

interface HumanNeededEmailProps {
  fullName?: string | null
  sessionName?: string | null
  sessionId: string
  projectName?: string | null
  sessionUrl: string
}

export function HumanNeededEmail({
  fullName,
  sessionName,
  sessionId,
  projectName,
  sessionUrl,
}: HumanNeededEmailProps) {
  const greeting = fullName ? `Hi ${fullName}` : 'Hi there'
  const displayName = sessionName || `Session ${sessionId.slice(0, 8)}`

  return (
    <Html>
      <Head />
      <Preview>A customer conversation needs your attention</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{greeting},</Heading>

          <Text style={text}>
            A customer conversation requires human intervention:
          </Text>

          <Section style={sessionBox}>
            <Text style={sessionTitle}>{displayName}</Text>
            {projectName && <Text style={sessionMeta}>Project: {projectName}</Text>}
          </Section>

          <Text style={text}>
            The AI support agent has flagged this session for human takeover. This typically
            happens when the customer has a complex issue that requires personal attention.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={sessionUrl}>
              View Conversation
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You can respond to the customer directly from the Hissuno dashboard, or if you
            received a Slack notification, you can reply there and your message will be
            delivered to the customer.
          </Text>

          <Link href={sessionUrl} style={footerLink}>
            Open in Hissuno
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

const sessionBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
}

const sessionTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 4px',
}

const sessionMeta = {
  color: '#64748b',
  fontSize: '14px',
  margin: '0',
}

const buttonContainer = {
  margin: '24px 0',
}

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
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

export default HumanNeededEmail
