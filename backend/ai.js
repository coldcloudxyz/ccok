// ─────────────────────────────────────────────────────────────────
// AI message generation — powered by OpenRouter (Mistral 7B)
// Falls back to built-in templates when key is missing or call fails
// ─────────────────────────────────────────────────────────────────
const axios = require('axios')

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL          = 'mistralai/mistral-7b-instruct'

const CHANNEL_GUIDE = {
  whatsapp: 'WhatsApp message. Conversational, under 150 words, 1-2 emojis at most.',
  sms:      'SMS. Under 160 characters. Short and direct. No emojis.',
  call:     'Voice call script read aloud. Natural spoken language, under 50 words, no symbols or emojis.',
}

const STEP_GUIDE = {
  1: 'First contact — warm and helpful, no pressure.',
  2: 'Second follow-up — no response yet. Brief and friendly, light urgency.',
  3: 'Third follow-up — create genuine urgency while remaining professional.',
  4: 'Final follow-up — honest last attempt, no pressure, clear call to action.',
}

async function generateMessage({ leadName, context, notes, step, channel, bizName, bizDesc, senderName, senderPhone, signOff }) {
  const firstName = leadName.split(' ')[0]
  const apiKey    = process.env.OPENROUTER_API_KEY

  if (apiKey) {
    try {
      const sender = senderName || bizName || 'the team'
      const intro  = (signOff || sender) + (bizName ? ' from ' + bizName : '')
      const cbNote = senderPhone ? ` The sender can be reached at ${senderPhone}.` : ''

      const prompt = [
        `Write a ${channel} follow-up message for a lead named ${firstName}.`,
        `Sender: ${intro}.`,
        bizDesc ? `Business: ${bizDesc}.` : '',
        `Lead context: ${context}`,
        notes   ? `Notes: ${notes}` : '',
        `Tone: ${STEP_GUIDE[step] || STEP_GUIDE[1]}`,
        `Format: ${CHANNEL_GUIDE[channel] || CHANNEL_GUIDE.sms}`,
        `Sign the message from "${sender}" so the lead knows who is contacting them.${cbNote}`,
        'Return only the message text. No quotes, no preamble, no explanation.',
      ].filter(Boolean).join('\n')

      const response = await axios.post(
        OPENROUTER_URL,
        {
          model:    MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization':  `Bearer ${apiKey}`,
            'Content-Type':   'application/json',
            'HTTP-Referer':   process.env.FRONTEND_URL || 'https://coldcloud.io',
            'X-Title':        'ColdCloud',
          },
          timeout: 15000,
        }
      )

      const text = response.data?.choices?.[0]?.message?.content?.trim()
      if (text && text.length > 20) {
        console.log(`[AI] Generated ${channel} step ${step} for ${firstName}`)
        return text
      }
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.error?.message || err.message
      console.warn(`[AI] OpenRouter failed (${status || 'network'}): ${detail} — using template`)
    }
  } else {
    console.warn('[AI] OPENROUTER_API_KEY not set — using template')
  }

  return fallbackTemplate({ firstName, context, step, channel, senderName, senderPhone, signOff, bizName })
}

function fallbackTemplate({ firstName, context, step, channel, senderName, senderPhone, signOff, bizName }) {
  const c       = context.substring(0, 70)
  const sender  = senderName || 'us'
  const company = bizName    || ''
  const intro   = (signOff || sender) + (company ? ' from ' + company : '')
  const cb      = senderPhone ? ' You can reach me at ' + senderPhone + '.' : ''

  const t = {
    1: {
      whatsapp: `Hi ${firstName}, this is ${intro}. Just wanted to follow up on your interest in ${c}. Happy to answer any questions — just reply here!`,
      sms:      `Hi ${firstName}, ${sender} here — following up on your enquiry about ${c}. Questions? Reply anytime.${cb}`,
      call:     `Hello ${firstName}, this is ${intro} calling to follow up on your interest in ${c}. We would love to help. Please feel free to call me back.${cb}`,
    },
    2: {
      whatsapp: `Hey ${firstName}, ${sender} again. Just checking in — no rush at all. Any questions I can answer?`,
      sms:      `${firstName}, ${sender} here. Still thinking it over? Happy to help — just reply.${cb}`,
      call:     `Hello ${firstName}, ${sender} calling again. We still have availability and would love to work with you. Please reach out whenever convenient.${cb}`,
    },
    3: {
      whatsapp: `Hi ${firstName}, ${sender} here. I don't want you to miss out — things are moving on our end. What would it take to get started?${cb}`,
      sms:      `${firstName} — ${sender} here. Limited availability this week. Still interested? Reply now.${cb}`,
      call:     `Hello ${firstName}, ${sender} calling again. We genuinely believe we can help and availability is getting limited. Please reach out today.${cb}`,
    },
    4: {
      whatsapp: `Hi ${firstName}, ${sender} here one last time. If you're still open to it, I'd love to connect — just reply. If not, no worries. Wishing you all the best!`,
      sms:      `${firstName} — final message from ${sender}. Still interested? Reply YES. Otherwise, all the best!`,
      call:     `Hello ${firstName}, this is ${sender} with a final follow-up. If you are still interested please reach out.${cb} Wishing you all the best.`,
    },
  }

  return (t[step] && t[step][channel])
    || `Hi ${firstName}, ${sender} here following up on your interest. Feel free to reach out whenever you're ready.`
}

module.exports = { generateMessage }
