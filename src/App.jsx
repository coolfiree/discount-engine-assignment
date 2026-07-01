/**
 * App.jsx
 *
 * Top-level component. Manages state for rules, cart items, and results.
 * Wires together CSV/PDF upload → parse → engine → display.
 */

import { useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import { parseRulesCSV, parseCartCSV } from './engine/csvParser.js'
import { processCart } from './engine/discountEngine.js'
import { extractCartItemsFromPdf } from './engine/pdfParser.js'
import { parseNaturalLanguageRule } from './engine/ruleIntake.js'

const formatCurrency = (value) => `Rs.${Number(value).toLocaleString('en-IN')}`

const RULES_COLUMNS = [
  { key: 'ruleId', label: 'Rule ID' },
  { key: 'scope', label: 'Scope', render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  { key: 'appliesTo', label: 'Applies To', render: (v) => v || '—' },
  { key: 'type', label: 'Type', render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  { key: 'value', label: 'Value', render: (v, row) => (row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`) },
  { key: 'minCartValue', label: 'Min Cart Value', render: (v) => (v ? formatCurrency(v) : '—') },
  { key: 'stackable', label: 'Stackable', render: (v) => (v ? 'Yes' : 'No') },
]

const CART_COLUMNS = [
  { key: 'itemId', label: 'Item' },
  { key: 'product', label: 'Product' },
  { key: 'brand', label: 'Brand' },
  { key: 'platform', label: 'Platform' },
  { key: 'basePrice', label: 'Base Price', render: (v) => formatCurrency(v) },
]

const RESULTS_COLUMNS = [
  { key: 'itemId', label: 'Item' },
  { key: 'product', label: 'Product' },
  { key: 'basePrice', label: 'Base Price', render: (v) => formatCurrency(v) },
  {
    key: 'finalPrice',
    label: 'Final Price',
    render: (v, row) => (
      <span style={{ fontWeight: 700, color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48' }}>
        {formatCurrency(v)}
      </span>
    ),
  },
  {
    key: 'totalDiscount',
    label: 'You Save',
    render: (v) => (v > 0 ? <span style={{ color: '#1e5c2c', fontWeight: 600 }}>{formatCurrency(v)}</span> : <span style={{ color: '#888' }}>—</span>),
  },
  {
    key: 'reasoning',
    label: 'Offer Applied',
    render: (v) => (
      <span style={{ color: v === 'No offers available' ? '#888' : '#131A48', fontStyle: v === 'No offers available' ? 'italic' : 'normal' }}>
        {v}
      </span>
    ),
  },
]

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f8f8fb 0%, #eef1f7 100%)',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    background: '#131A48',
    padding: '0.95rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoTxt: { fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' },
  logoSpan: { color: '#FF5800' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  main: { maxWidth: 1120, margin: '0 auto', padding: '1.8rem 1.5rem 2.5rem' },
  section: { background: '#fff', border: '1px solid #CECECE', borderRadius: 8, padding: '1.2rem 1.4rem', marginBottom: '1.2rem' },
  sectionTitle: { fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: '#131A48', marginBottom: '0.7rem', paddingBottom: 6, borderBottom: '2px solid #FF5800', display: 'inline-block' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  btn: {
    background: '#FF5800',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.7rem 1.8rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  btnSecondary: {
    background: '#131A48',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.7rem 1.4rem',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.7rem 1.8rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'not-allowed',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '2px solid #131A48',
  },
  totalLabel: { fontWeight: 700, fontSize: 14, color: '#131A48' },
  totalValue: { fontWeight: 700, fontSize: 16, color: '#131A48' },
  helper: { fontSize: 11, color: '#666', marginTop: 6 },
  ruleInput: { width: '100%', minHeight: 94, resize: 'vertical', borderRadius: 8, border: '1px solid #CECECE', padding: '0.8rem 0.9rem', fontSize: 13, lineHeight: 1.45, fontFamily: 'inherit' },
  previewGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem 0.9rem', marginTop: '0.75rem', padding: '0.9rem', background: '#f8f9fc', border: '1px solid #d9deeb', borderRadius: 8 },
  previewItem: { fontSize: 13, color: '#131A48' },
  previewLabel: { display: 'block', fontSize: 10, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 },
  ruleActions: { display: 'flex', gap: '0.65rem', marginTop: '0.85rem', flexWrap: 'wrap' },
  noteBox: { marginTop: '0.85rem', padding: '0.75rem 0.9rem', borderRadius: 8, background: '#fff7ef', border: '1px solid #ffd8b5', color: '#8a4b11', fontSize: 13 },
  cartSummary: { display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.65rem', color: '#1e5c2c', fontWeight: 600 },
}

function createRuleId(existingRules) {
  const nextNumber = existingRules.reduce((max, rule) => {
    const match = String(rule.ruleId || '').match(/(\d+)/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `RULE-NL-${String(nextNumber + 1).padStart(2, '0')}`
}

export default function App() {
  const [rules, setRules] = useState([])
  const [rulesErrors, setRulesErrors] = useState([])
  const [rulesFileName, setRulesFileName] = useState('')

  const [cartItems, setCartItems] = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartFileName, setCartFileName] = useState('')
  const [cartSource, setCartSource] = useState('csv')

  const [results, setResults] = useState(null)
  const [ruleDraft, setRuleDraft] = useState('')
  const [ruleParseError, setRuleParseError] = useState('')
  const [pendingRule, setPendingRule] = useState(null)
  const [pendingRulePreview, setPendingRulePreview] = useState(null)
  const [isParsingRule, setIsParsingRule] = useState(false)

  function recalculate(nextRules, nextCartItems) {
    if (nextRules.length > 0 && nextCartItems.length > 0) {
      setResults(processCart(nextCartItems, nextRules))
      return
    }

    setResults(null)
  }

  function handleRulesLoad(csvText, fileName) {
    const { data, errors } = parseRulesCSV(csvText)
    setRules(data)
    setRulesErrors(errors)
    setRulesFileName(fileName)
    recalculate(data, cartItems)
  }

  function handleCartCsvLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
    setCartItems(data)
    setCartErrors(errors)
    setCartFileName(fileName)
    setCartSource('csv')
    recalculate(rules, data)
  }

  async function handleCartPdfLoad(arrayBuffer, fileName) {
    try {
      const data = await extractCartItemsFromPdf(arrayBuffer)
      setCartItems(data)
      setCartErrors(data.length > 0 ? [] : ['No cart rows could be extracted from the PDF.'])
      setCartFileName(fileName)
      setCartSource('pdf')
      recalculate(rules, data)
    } catch (error) {
      setCartErrors([error instanceof Error ? error.message : 'Failed to parse the uploaded PDF.'])
    }
  }

  function handleCalculate() {
    setResults(processCart(cartItems, rules))
  }

  async function handleParseRule() {
    setIsParsingRule(true)

    try {
      const parsed = await parseNaturalLanguageRule(ruleDraft)

      if (parsed.error) {
        setRuleParseError(parsed.error)
        setPendingRule(null)
        setPendingRulePreview(null)
        return
      }

      setRuleParseError('')
      setPendingRule({ ...parsed.rule, ruleId: createRuleId(rules) })
      setPendingRulePreview(parsed.preview)
    } finally {
      setIsParsingRule(false)
    }
  }

  function handleConfirmRule() {
    if (!pendingRule) {
      return
    }

    const nextRules = [...rules, pendingRule]
    setRules(nextRules)
    setRulesErrors([])
    setPendingRule(null)
    setPendingRulePreview(null)
    setRuleDraft('')
    recalculate(nextRules, cartItems)
  }

  function handleDiscardRule() {
    setPendingRule(null)
    setPendingRulePreview(null)
    setRuleDraft('')
    setRuleParseError('')
  }

  const canCalculate = rules.length > 0 && cartItems.length > 0

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.logoTxt}>O<span style={S.logoSpan}>pp</span>tra</div>
        <div style={S.headerSub}>Discount Engine</div>
      </div>

      <div style={S.main}>
        <div style={S.grid2}>
          <div style={S.section}>
            <div style={S.sectionTitle}>Discount Rules</div>
            <CsvUploader
              label="rules.csv"
              description="Upload your discount rules CSV"
              onLoad={handleRulesLoad}
              hasData={rules.length > 0}
              fileName={rulesFileName}
              accept=".csv"
              readAs="text"
            />
            <ErrorBanner errors={rulesErrors} />
            {rules.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {rules.length} rule{rules.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={RULES_COLUMNS} rows={rules} />
              </div>
            )}
          </div>

          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Items</div>
            <CsvUploader
              label="cart.csv"
              description="Upload your cart CSV"
              onLoad={handleCartCsvLoad}
              hasData={cartItems.length > 0 && cartSource === 'csv'}
              fileName={cartFileName}
              accept=".csv"
              readAs="text"
            />
            <div style={{ height: 10 }} />
            <CsvUploader
              label="cart.pdf"
              description="Upload a cart PDF table"
              onLoad={handleCartPdfLoad}
              hasData={cartItems.length > 0 && cartSource === 'pdf'}
              fileName={cartFileName}
              accept=".pdf"
              readAs="arrayBuffer"
            />
            <ErrorBanner errors={cartErrors} />
            {cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} loaded from {cartSource.toUpperCase()}
                </div>
                <DataTable columns={CART_COLUMNS} rows={cartItems} />
              </div>
            )}
          </div>
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>Add Rule From Text</div>
          <div style={{ fontSize: 13, color: '#444', marginBottom: 10 }}>
            Describe a rule in plain English, parse it, then confirm before it is added to the active rule set.
          </div>
          <textarea
            style={S.ruleInput}
            value={ruleDraft}
            onChange={(event) => {
              setRuleDraft(event.target.value)
              setRuleParseError('')
            }}
            placeholder="Example: 10% off if cart value is more than Rs.5,000"
          />
          <div style={S.ruleActions}>
            <button style={S.btnSecondary} onClick={handleParseRule} disabled={!ruleDraft.trim() || isParsingRule}>
              {isParsingRule ? 'Parsing...' : 'Parse Rule'}
            </button>
            <button style={S.btnSecondary} onClick={handleDiscardRule} disabled={!pendingRule && !ruleDraft}>
              Clear
            </button>
          </div>
          {ruleParseError && <div style={S.noteBox}>{ruleParseError}</div>}
          {pendingRulePreview && (
            <>
              <div style={S.previewGrid}>
                <div style={S.previewItem}><span style={S.previewLabel}>Scope</span>{pendingRulePreview.scope}</div>
                <div style={S.previewItem}><span style={S.previewLabel}>Applies To</span>{pendingRulePreview.appliesTo}</div>
                <div style={S.previewItem}><span style={S.previewLabel}>Type</span>{pendingRulePreview.type}</div>
                <div style={S.previewItem}><span style={S.previewLabel}>Value</span>{pendingRulePreview.value}</div>
                <div style={S.previewItem}><span style={S.previewLabel}>Stackable</span>{pendingRulePreview.stackable}</div>
                <div style={S.previewItem}><span style={S.previewLabel}>Min Cart Value</span>{pendingRulePreview.minCartValue}</div>
              </div>
              <div style={S.ruleActions}>
                <button style={S.btn} onClick={handleConfirmRule}>
                  Confirm Add Rule
                </button>
                <button style={S.btnSecondary} onClick={handleDiscardRule}>
                  Discard
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button style={canCalculate ? S.btn : S.btnDisabled} onClick={handleCalculate} disabled={!canCalculate}>
            Calculate Discounts
          </button>
          {!canCalculate && (
            <div style={S.helper}>Upload both files to calculate, or add a rule and let the engine re-run automatically.</div>
          )}
        </div>

        {results && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Summary</div>
            <DataTable columns={RESULTS_COLUMNS} rows={results.items} />

            <div style={S.totalRow}>
              <span style={S.totalLabel}>Subtotal</span>
              <span style={S.totalValue}>{formatCurrency(results.cartSummary.subtotal)}</span>
            </div>

            {results.cartSummary.appliedRule && (
              <div style={S.cartSummary}>
                <span>{results.cartSummary.reasoning}</span>
              </div>
            )}

            <div style={S.totalRow}>
              <span style={S.totalLabel}>Final Cart Total</span>
              <span style={{ ...S.totalValue, color: '#1e5c2c' }}>{formatCurrency(results.cartSummary.finalTotal)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
