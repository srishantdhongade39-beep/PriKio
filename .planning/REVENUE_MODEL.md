# Prikio - Revenue & Business Model
*(Prepared for CA Meeting)*

## 1. Business Overview
Prikio is a cloud-based, frictionless print kiosk system designed for college campuses. It eliminates the need for manual print shops by allowing students to upload, configure, and pay for print jobs via their personal devices (via QR/URL) or kiosk terminals (via RFID) using UPI. 

## 2. Revenue Streams
### A. Primary Revenue: Pay-Per-Print
Based on the current database configuration (`print_config` table):
- **Black & White (B&W) Printing:** ₹2.00 per page 
- **Color Printing:** ₹8.00 per page 

### B. Future/Secondary Revenue Opportunities
- **Premium Cloud Storage:** Users currently receive a 500MB free tier. Monetization can be introduced via subscription for higher storage caps (e.g., ₹49/month for 5GB).
- **Priority Printing (Fast-track):** A small surcharge for skipping the queue during peak exam seasons.
- **Digital Advertising:** Displaying college event promos, sponsor messages, or local business ads on the kiosk's idle screensaver.

## 3. Cost Structure (Expenses)
### A. Variable Costs (Cost of Goods Sold - COGS)
- **Consumables (Paper):** ~₹0.60 per A4 sheet.
- **Consumables (Toner/Ink):** ~₹0.40 per B&W page | ~₹2.50 per Color page.
- **Payment Gateway Fees (Razorpay):** ~2% per transaction (Note: UPI transactions may have lower or zero MDR depending on government regulations and Razorpay's specific pricing tier, but 2% is a safe buffer).

### B. Fixed & Semi-Fixed Costs (OPEX)
- **Hardware & Asset Depreciation:** Kiosk screens, commercial printers, and RFID readers (capital expenditures amortized over 3-5 years).
- **Software Infrastructure:** Serverless hosting (Vercel), Database, Auth & Storage (Supabase). These scale with usage but have low baseline costs.
- **Maintenance & Operations:** Labor for paper/toner refilling, printer servicing, electricity, and internet connectivity at the kiosk locations.

## 4. Unit Economics (Per Page Profitability)
*Estimates based on standard market rates. Exact margins depend on bulk procurement.*

**Black & White Print (₹2.00 Revenue):**
- Paper: ₹0.60
- Toner: ₹0.40
- Gateway Fee (estimated 2%): ₹0.04
- **Gross Margin:** **₹0.96 per page (~48%)**

**Color Print (₹8.00 Revenue):**
- Paper: ₹0.60
- Ink/Toner: ₹2.50
- Gateway Fee (estimated 2%): ₹0.16
- **Gross Margin:** **₹4.74 per page (~59%)**

## 5. Sample Financial Projection (Per Campus/Month)
*Assumes a mid-sized college as a baseline scenario.*
- **Target Audience:** 5,000 students
- **Average Usage:** 20 pages/month per student (assuming 90% B&W, 10% Color)
- **Monthly Volume:** 100,000 pages (90k B&W, 10k Color)
- **Monthly Revenue:** ₹1,80,000 (B&W) + ₹80,000 (Color) = **₹2,60,000**
- **Monthly COGS:** ~₹90,000 (B&W) + ~₹31,000 (Color) = **~₹1,21,000**
- **Estimated Gross Profit:** **~₹1,39,000 / month / campus** (Before OPEX, depreciation, and taxes)

## 6. Key Agenda Points for the CA Meeting
To make the most of your meeting with the Chartered Accountant tomorrow, discuss the following:
1. **Asset Depreciation:** What is the best method (Straight-Line vs. WDV) for writing off kiosk and printer hardware to optimize tax liability?
2. **GST Compliance & ITC:** What are the applicable GST rates for automated printing services (typically 18%), and how can we maximize Input Tax Credit (ITC) on bulk paper, printer, and toner purchases?
3. **Micro-transaction Accounting:** Best practices for reconciling thousands of small UPI micro-transactions via Razorpay in your accounting software (e.g., Tally/Zoho).
4. **College Revenue Share Agreements:** If the college requires a cut for providing space and electricity, how should this revenue share or rental agreement be structured for tax efficiency?
5. **Software capitalization:** Can the development cost of the Prikio software be capitalized as an intangible asset?
