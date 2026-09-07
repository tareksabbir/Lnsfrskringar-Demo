'use client'

import { BlockPlayground } from '../playground'
import ContactForm from '@/components/blocks/ContactForm'

/**
 * The form here is live — submitting it posts to /api/contact like any other
 * copy of the block. That is deliberate: a showcase that fakes the submit
 * would not tell you whether the endpoint works, which is the only part of a
 * form worth demonstrating.
 */
export default function ContactFormPlayground() {
  return (
    <BlockPlayground
      defaults={{ layout: 'stacked', color: 'surface' }}
      controls={[
        {
          type: 'buttons',
          key: 'layout',
          label: 'Layout',
          options: [
            { label: 'Stacked', value: 'stacked' },
            { label: 'Compact', value: 'compact' },
          ],
        },
        {
          type: 'buttons',
          key: 'color',
          label: 'Background',
          options: [
            { label: 'Surface', value: 'surface' },
            { label: 'Canvas',  value: 'canvas'  },
            { label: 'Tint',    value: 'tint'    },
          ],
        },
      ]}
    >
      {(s) => (
        <div className="mx-auto w-full max-w-2xl">
          <ContactForm
            heading="Contact us"
            intro="Send us a message and we will get back to you within two working days."
            nameLabel="Your name"
            emailLabel="Email address"
            subjectLabel="Subject"
            messageLabel="How can we help?"
            consentText="I agree that Länsförsäkringar Stockholm may use my details to answer this enquiry."
            submitLabel="Send message"
            successMessage="Thank you — your message has been received. We will be in touch within two working days."
            layout={String(s.layout) as 'stacked' | 'compact'}
            color={String(s.color) as 'surface' | 'canvas' | 'tint'}
          />
        </div>
      )}
    </BlockPlayground>
  )
}
