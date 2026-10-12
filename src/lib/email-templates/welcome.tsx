import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { name?: string; role?: string; url?: string }

function Welcome({ name, role, url }: Props) {
  const isBrand = role === 'brand'
  return (
    <Html>
      <Head />
      <Preview>Welcome to Qolabrate</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ padding: '24px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '24px', color: '#111111' }}>Welcome to Qolabrate{name ? `, ${name}` : ''}!</Heading>
          <Text style={{ color: '#333333', fontSize: '15px', lineHeight: '24px' }}>
            {isBrand
              ? 'Your brand account is ready. Find creators, post campaigns and send collab requests.'
              : 'Your creator account is ready. Complete your profile so brands can discover you and invite you to collaborate.'}
          </Text>
          <Button href={url ?? 'https://qolabrate.chinmaipilot.in'} style={{ backgroundColor: '#7c3aed', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '15px' }}>
            {isBrand ? 'Open brand dashboard' : 'Open my profile'}
          </Button>
          <Text style={{ color: '#888888', fontSize: '12px', marginTop: '24px' }}>— The Qolabrate team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Welcome,
  subject: 'Welcome to Qolabrate',
  displayName: 'Welcome',
  previewData: { name: 'Arjun', role: 'creator' },
} satisfies TemplateEntry
