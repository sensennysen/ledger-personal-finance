import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const apiKey = process.env.OPENAI_API_KEY?.trim()
assert.ok(apiKey, 'Set OPENAI_API_KEY in your environment or in the git-ignored .env file at the repo root.')

const transactionFormat = {
  type: 'json_schema',
  name: 'transaction_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      merchant: { type: ['string', 'null'] },
      amount_minor: { type: ['integer', 'null'] },
      currency: { type: ['string', 'null'] },
      date: { type: ['string', 'null'] },
    },
    required: ['merchant', 'amount_minor', 'currency', 'date'],
    additionalProperties: false,
  },
}

async function extractTransaction(content) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-6-luna',
      store: false,
      reasoning: { effort: 'none' },
      max_output_tokens: 256,
      instructions: [
        'Extract the transaction fields from the provided phrase or receipt.',
        'Use the final amount charged, ignoring subtotals, tendered cash, and change.',
        'Report PHP amounts in centavos and currency as a three-letter currency code.',
        'Use a supplied default currency only if the input omits it.',
        'Return dates as YYYY-MM-DD. Use null for missing or ambiguous fields.',
      ].join(' '),
      input: [{ role: 'user', content }],
      text: { format: transactionFormat },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  const result = await response.json().catch(() => null)
  const requestId = response.headers.get('x-request-id') ?? 'unavailable'
  if (!response.ok) {
    throw new Error(`OpenAI HTTP ${response.status} (${result?.error?.code ?? 'unknown error'}, request ID ${requestId})`)
  }

  const reason = result?.incomplete_details?.reason ?? 'no reason returned'
  assert.equal(result?.status, 'completed', `OpenAI response did not complete (${reason}, request ID ${requestId}).`)

  const message = result.output?.find((item) => item.type === 'message' && item.role === 'assistant')
  const output = message?.content?.find((item) => item.type === 'output_text')
  assert.ok(output?.text, `OpenAI returned no extraction (${message?.content?.[0]?.type ?? 'no message'}, request ID ${requestId}).`)
  return JSON.parse(output.text)
}

test('OpenAI extracts a transaction from a short phrase', async () => {
  const transaction = await extractTransaction([
    { type: 'input_text', text: 'Default currency: PHP. Transaction phrase: Jollibee 189' },
  ])

  assert.deepEqual(transaction, { merchant: 'Jollibee', amount_minor: 18_900, currency: 'PHP', date: null })
})

test('OpenAI reads the final total and date from a synthetic receipt', async () => {
  const receipt = await readFile(new URL('./fixtures/openai-smoke-receipt.png', import.meta.url))
  const transaction = await extractTransaction([
    { type: 'input_text', text: 'Read this receipt.' },
    { type: 'input_image', image_url: `data:image/png;base64,${receipt.toString('base64')}` },
  ])

  assert.deepEqual(transaction, { merchant: 'Harbor Cafe', amount_minor: 24_950, currency: 'PHP', date: '2026-11-08' })
})
