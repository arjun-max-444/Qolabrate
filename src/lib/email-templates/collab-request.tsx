import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props { brand?: string; title?: string; budget?: string; url?: string }

function CollabRequest({ brand, title, budget, url }: Props) {
  return (
    <Html>
      <Head />
      <Preview>New collab request on Qolabrate</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ padding: '24px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '22px', color: '#111111' }}>You have a new collab request</Heading>
          <Text style={{ color: '#333333', fontSize: '15px', lineHeight: '24px' }}>
            {brand ?? 'A brand'} invited you to collaborate{title ? ` on "${title}"` : ''}.{budget ? ` Budget: ${budget}.` : ''}
          </Text>
          <Text style={{ color: '#333333', fontSize: '15px' }}>Requests expire after 7 days — accept, decline or counter from your invitations.</Text>
          <Button href={url ?? 'https://qolabrate.chinmaipilot.in/collabs'} style={{ backgroundColor: '#7c3aed', color: '#ffffff', padding: '12px 20px', borderRadius: '8px', fontSize: '15px' }}>
            View invitation
          </Button>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CollabRequest,
  subject: (d: Record<string, any>) => `New collab request${d['brand'] ? ` from ${d['brand']}` : ''}`,
  displayName: 'Collab request notification',
  previewData: { brand: 'GlowRoot', title: 'Summer launch reel', budget: '$500–$1,000' },
} satisfies TemplateEntry
