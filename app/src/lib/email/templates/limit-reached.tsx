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

interface LimitReachedEmailProps {
  fullName?: string | null
  dimension: string
  current: number
  limit: number
  upgradeUrl: string
}

const dimensionLabels: Record<string, string> = {
  sessions: 'session',
  analyzed_issues: 'analyzed issue',
}

export function LimitReachedEmail({
  fullName,
  dimension,
  current,
  limit,
  upgradeUrl,
}: LimitReachedEmailProps) {
  const greeting = fullName ? `Hi ${fullName}` : 'Hi there'
  const dimensionLabel = dimensionLabels[dimension] ?? dimension
  const pluralLabel = limit === 1 ? dimensionLabel : `${dimensionLabel}s`

  return (
    <Html>
      <Head />
      <Preview>
        You&apos;ve reached your {dimensionLabel} limit on Hissuno
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{greeting},</Heading>

          <Text style={text}>
            You&apos;ve reached your <strong>{dimensionLabel} limit</strong> on Hissuno.
            Your current plan allows for {limit} {pluralLabel}, and you&apos;ve used{' '}
            {current}.
          </Text>

          <Text style={text}>
            {dimension === 'sessions' ? (
              <>
                New support conversations will still be handled, but{' '}
                <strong>PM review and issue creation will be paused</strong> until you
                upgrade or your limit resets next billing period.
              </>
            ) : dimension === 'analyzed_issues' ? (
              <>
                Issues will still be created from feedback, but{' '}
                <strong>issue analysis will be paused</strong> until you
                upgrade or your limit resets next billing period.
              </>
            ) : (
              <>
                You won&apos;t be able to use more {pluralLabel} until you upgrade your
                plan.
              </>
            )}
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={upgradeUrl}>
              Upgrade Your Plan
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            If you have any questions about your plan or limits, just reply to this email.
          </Text>

          <Link href={upgradeUrl} style={footerLink}>
            Manage your billing
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
  backgroundColor: '#dc2626',
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

export default LimitReachedEmail
