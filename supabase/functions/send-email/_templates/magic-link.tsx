import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Img,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface MagicLinkEmailProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
}

export const MagicLinkEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
}: MagicLinkEmailProps) => (
  <Html>
    <Head />
    <Preview>Accede a tu cuenta de RiskCare con este enlace mágico</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoContainer}>
          <Heading style={h1}>RiskCare Pacientes</Heading>
        </div>
        
        <Heading style={h2}>Acceso a tu cuenta</Heading>
        
        <Text style={text}>
          Has solicitado acceder a tu cuenta de RiskCare Pacientes. Haz clic en el siguiente enlace para iniciar sesión de forma segura:
        </Text>
        
        <Link
          href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          target="_blank"
          style={button}
        >
          Iniciar sesión en RiskCare
        </Link>
        
        <Text style={{ ...text, marginTop: '24px' }}>
          O copia y pega este código de acceso temporal:
        </Text>
        
        <code style={code}>{token}</code>
        
        <Text style={disclaimerText}>
          Si no solicitaste este acceso, puedes ignorar este correo de forma segura.
        </Text>
        
        <div style={divider}></div>
        
        <Text style={footer}>
          <strong>RiskCare Pacientes</strong> - Asistente Clínico Personal
          <br />
          Tu salud, siempre a tu alcance
        </Text>
        
        <Text style={legalText}>
          Este es un correo automático generado por RiskCare. La información médica es confidencial y está protegida bajo las normativas de privacidad de datos de salud.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  borderRadius: '8px',
  maxWidth: '600px',
}

const logoContainer = {
  textAlign: 'center' as const,
  marginBottom: '32px',
}

const h1 = {
  color: '#1a365d',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0',
  textAlign: 'center' as const,
}

const h2 = {
  color: '#2d3748',
  fontSize: '20px',
  fontWeight: '600',
  margin: '24px 0 16px',
}

const text = {
  color: '#4a5568',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  margin: '20px 0',
}

const code = {
  display: 'inline-block',
  padding: '16px 24px',
  width: '100%',
  backgroundColor: '#f7fafc',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  color: '#2d3748',
  fontSize: '18px',
  fontWeight: '600',
  letterSpacing: '2px',
  textAlign: 'center' as const,
  fontFamily: 'monospace',
}

const disclaimerText = {
  color: '#718096',
  fontSize: '14px',
  lineHeight: '20px',
  marginTop: '24px',
  fontStyle: 'italic',
}

const divider = {
  borderTop: '1px solid #e2e8f0',
  margin: '32px 0',
}

const footer = {
  color: '#4a5568',
  fontSize: '14px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '16px 0',
}

const legalText = {
  color: '#a0aec0',
  fontSize: '12px',
  lineHeight: '18px',
  textAlign: 'center' as const,
  margin: '16px 0 0',
}
