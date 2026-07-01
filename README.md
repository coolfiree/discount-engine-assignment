# Opptra Discount Engine

Submission-ready discount engine for the Opptra FDE Intern assignment.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

To enable the AI-backed rule parser, set `VITE_GEMINI_API_KEY` before running the app. You can also set `VITE_GEMINI_MODEL` if you want to override the default model; the fallback is `gemini-2.0-flash`.

## Build

```bash
npm run build
```

Deploy the `dist/` folder to Vercel, Netlify, or another static host.
Live deployment URL: add your deployed URL here before submission.

## Features

1. Upload discount rules from CSV.
2. Upload cart items from CSV or PDF.
3. Add a new rule from plain English, review the parsed fields, then confirm or discard it.
4. Apply item-level discounts with max-savings selection and stacking.
5. Apply cart-level discounts after item discounts and show the cart offer as a separate summary line.

## How to use

1. Upload `sample-data/rules.csv`.
2. Upload `sample-data/cart.csv` or a cart PDF.
3. Enter a plain-English rule if needed, then click **Calculate Discounts**.

## Sample data

`sample-data/rules.csv` includes the cart-level rule expected by the brief.

```csv
rule_id,scope,applies_to,type,value,stackable,min_cart_value
RULE-01,platform,Amazon India,percentage,15,false,
RULE-02,brand,Natura Casa,flat,150,false,
RULE-03,platform,Flipkart,percentage,10,true,
RULE-04,cart,,percentage,10,false,4000
```

## Discount logic

- When multiple non-stackable rules match an item, the one giving the largest saving in rupees is applied.
- Rules marked `stackable: true` apply on top of the winning non-stackable rule.
- If only stackable rules match, they still apply on their own.
- Cart rules are evaluated after item-level discounts and apply only when the subtotal meets the configured threshold.
- If no rules match, the base price is returned with a "No offers available" note.

## Project structure

```
src/
  engine/
    discountEngine.js   ← pure discount logic
    csvParser.js        ← CSV → typed objects
    pdfParser.js        ← PDF → cart items
    ruleIntake.js       ← plain-English rule parsing
  components/
    CsvUploader.jsx     ← file upload area
    DataTable.jsx       ← reusable table
    ErrorBanner.jsx     ← parse error display
  App.jsx               ← main UI + state
  main.jsx              ← entry point

sample-data/
  rules.csv             ← sample discount rules
  cart.csv              ← sample cart items
```

## Expected sample output

The sample cart should produce these item-level results:

| Item    | Final Price | Reasoning                              |
|---------|------------:|----------------------------------------|
| ITEM-01 | Rs.1,104    | Platform offer: 15% off                |
| ITEM-02 | Rs.629      | Brand offer: Rs.150 off + Platform 10% |
| ITEM-03 | Rs.509      | Platform offer: 15% off                |
| ITEM-04 | Rs.2,499    | No offers available                    |
| ITEM-05 | Rs.382      | Platform offer: 15% off                |
| ITEM-06 | Rs.809      | Platform offer: 10% off                |

Cart subtotal: Rs.5,932

Cart offer: Rs.593 saved

Final cart total: Rs.5,339
