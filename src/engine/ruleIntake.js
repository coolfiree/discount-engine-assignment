function cleanTarget(value) {
  return String(value || '')
    .replace(/^all\s+/i, '')
    .replace(/^the\s+/i, '')
    .replace(/\b(?:brand|platform|items?|products?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toInteger(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.round(numeric) : null
}

function normaliseParsedRule(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'The parser did not return a rule.' }
  }

  const scope = String(parsed.scope || '').toLowerCase()
  const type = String(parsed.type || '').toLowerCase()
  const appliesTo = cleanTarget(parsed.appliesTo)
  const stackable = Boolean(parsed.stackable)
  const value = toInteger(parsed.value)
  const minCartValue = parsed.minCartValue === null || parsed.minCartValue === undefined || parsed.minCartValue === ''
    ? null
    : toInteger(parsed.minCartValue)

  if (!['brand', 'platform', 'cart'].includes(scope)) {
    return { error: 'The parser returned an invalid scope.' }
  }

  if (!['percentage', 'flat'].includes(type)) {
    return { error: 'The parser returned an invalid discount type.' }
  }

  if (!Number.isFinite(value) || value <= 0) {
    return { error: 'The parser returned an invalid discount value.' }
  }

  if ((scope === 'brand' || scope === 'platform') && !appliesTo) {
    return { error: 'The parser returned an empty target.' }
  }

  if (scope === 'cart') {
    if (!Number.isFinite(minCartValue) || minCartValue <= 0) {
      return { error: 'The parser returned an invalid cart threshold.' }
    }

    return {
      rule: {
        scope: 'cart',
        appliesTo: '',
        type,
        value,
        stackable: false,
        minCartValue,
      },
      preview: {
        scope: 'Cart',
        appliesTo: 'Entire cart',
        type: type === 'percentage' ? 'Percentage' : 'Flat',
        value: type === 'percentage' ? `${value}%` : `Rs.${value}`,
        stackable: 'No',
        minCartValue: `Rs.${minCartValue.toLocaleString('en-IN')}`,
      },
    }
  }

  return {
    rule: {
      scope,
      appliesTo,
      type,
      value,
      stackable,
      minCartValue: null,
    },
    preview: {
      scope: scope === 'brand' ? 'Brand' : 'Platform',
      appliesTo,
      type: type === 'percentage' ? 'Percentage' : 'Flat',
      value: type === 'percentage' ? `${value}%` : `Rs.${value}`,
      stackable: stackable ? 'Yes' : 'No',
      minCartValue: '—',
    },
  }
}

async function callGemini(text) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    return { error: 'Set VITE_GEMINI_API_KEY to enable AI parsing.' }
  }

  const model = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash'

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: [
              'You are a discount rule parser.',
              'Return only valid JSON matching this schema:',
              '{"scope":"brand|platform|cart","appliesTo":"string","type":"percentage|flat","value":number,"stackable":boolean,"minCartValue":number|null}',
              'For cart rules, set appliesTo to an empty string and include minCartValue.',
              'For brand and platform rules, set minCartValue to null.',
              'Do not add commentary.',
            ].join(' '),
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          required: ['scope', 'appliesTo', 'type', 'value', 'stackable', 'minCartValue'],
          properties: {
            scope: { type: 'string', enum: ['brand', 'platform', 'cart'] },
            appliesTo: { type: 'string' },
            type: { type: 'string', enum: ['percentage', 'flat'] },
            value: { type: 'number' },
            stackable: { type: 'boolean' },
            minCartValue: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    return { error: `Gemini request failed: ${message}` }
  }

  const payload = await response.json()
  const textOutput = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''

  if (!textOutput) {
    return { error: 'Gemini did not return any text.' }
  }

  try {
    return JSON.parse(textOutput)
  } catch {
    return { error: 'Gemini returned invalid JSON.' }
  }
}

export async function parseNaturalLanguageRule(input) {
  const text = input.trim()

  if (!text) {
    return { error: 'Enter a rule description.' }
  }

  const parsed = await callGemini(text)
  if (parsed.error) {
    return parsed
  }

  return normaliseParsedRule(parsed)
}
