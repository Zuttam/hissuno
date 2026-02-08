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

interface InviteEmailProps {
  inviteCode: string
  signupUrl: string
  appUrl: string
  promotionCode?: string
  promotionDescription?: string
}

export function InviteEmail({ inviteCode, signupUrl, appUrl, promotionCode, promotionDescription }: InviteEmailProps) {
  const logoUrl = 'https://hissuno.com/logos/hissuno/light-mode-transparant.png'

  return (
    <Html>
      <Head />
      <Preview>You&apos;re invited to join Hissuno!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img src={logoUrl} alt="Hissuno" width={64} height={64} style={logo} />
          </Section>

          <Heading style={h1}>You&apos;re invited! &#127881;</Heading>

          <Text style={text}>
            Someone thinks you&apos;d love Hissuno &mdash; a customer intelligence platform
            that turns conversations into shipped features. We&apos;d love to have you join!
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={signupUrl}>
              Accept Invitation
            </Button>
          </Section>

          {promotionCode && (
            <Section style={promoBanner}>
              {promotionDescription && (
                <Text style={promoDescription}>{promotionDescription}</Text>
              )}
              <Section style={promoCodeBox}>
                <Text style={promoCodeText}>{promotionCode}</Text>
              </Section>
              <Text style={promoHint}>
                Copy this code and apply it at checkout.
              </Text>
            </Section>
          )}

          <Text style={codeText}>
            Or use this invite code during signup: <strong>{inviteCode}</strong>
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            If you didn&apos;t expect this invite, no worries &mdash; you can safely ignore this email.
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

const promoBanner = {
  backgroundColor: '#f0f7ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}

const promoDescription = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600' as const,
  lineHeight: '24px',
  margin: '0 0 12px',
}

const promoCodeBox = {
  backgroundColor: '#ffffff',
  border: '2px dashed #2563eb',
  borderRadius: '6px',
  padding: '10px 16px',
  margin: '0 auto',
  maxWidth: '200px',
}

const promoCodeText = {
  color: '#2563eb',
  fontSize: '20px',
  fontWeight: '700' as const,
  letterSpacing: '2px',
  margin: '0',
  textAlign: 'center' as const,
}

const promoHint = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 0 0',
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

export default InviteEmail
