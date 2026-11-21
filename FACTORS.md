# FACTORS.md: Scope Quest numbers, sources and judgment calls

**For the instructor to sign off before the lecture.** Every number on a reveal screen comes from this file. All of them live in `content/content.json` and can be changed in `/admin` without redeploying.

Status: ✅ = checked against the source PDF in `C:\Projects\GHG Project` · 🔎 = official source outside the PDFs, **verify the value before the lecture** (my build workspace couldn't download the original spreadsheet, so the value comes from a published copy of it).

---

## 0. The version in use: two activities (`content/content.json`)

The game now runs **lobby → Activity 1 → Activity 2 → finale** (podium, top players, takeaways). The full 23-scene game is kept in `content/content-full-23-scenes.json`, and sections 1–6 below describe it.

### Activity 1: Sort the scopes (drag into Scope 1 / 2 / 3)

| Card | Basket | Basis |
|---|---|---|
| Gas burnt in the bread ovens | Scope 1 | Corporate Std Ch. 4 (stationary combustion) |
| Refrigerant leaking from the cold room | Scope 1 | Corporate Std Ch. 4 (fugitive) |
| Nile Loaf's own diesel vans | Scope 1 | Table 5.7 row 1 |
| Grid electricity for bakeries & office | Scope 2 | Corporate Std / Scope 2 Guidance |
| Own electric vans charged at the depot | Scope 2 | Table 5.7 row 1 ("scope 2 for electricity use") |
| Chilled water bought for the head office (district cooling) | Scope 2 | Scope 2 Guidance: purchased electricity, steam, heat **and cooling** (new card, not in the deck) |
| The courier Nile Loaf pays | Scope 3 | Table 5.7 row 7 (Cat 4) |
| Staff flights to a trade fair | Scope 3 | Table 6.1 row 2 (Cat 6) |
| Staff commuting | Scope 3 | Table 6.1 row 3 (Cat 7) |

Points: 100 for the right basket + up to 20 for speed. There's no category bonus in this version.

### Activity 2: What kind of data is it? (drag into Site-specific / Primary / Secondary)

Definitions, ISO 14064-1:2018 (checked against the scan):
- **3.2.2 primary data:** quantified value of a process or activity from a direct measurement, or a calculation based on direct measurements. Note 1: it can be an emission factor and/or activity data.
- **3.2.3 site-specific data:** primary data obtained **within the organizational boundary**. Note 1: all site-specific data are primary, but not all primary data are site-specific.
- **3.2.4 secondary data:** data from sources other than primary data, e.g. databases and published literature validated by competent authorities.
- Annex C.2: primary vs secondary depends on who originally collected the data; site-specific depends on whether it came from the original source. Annex C.5: non-site-specific data include literature data (e.g. default emission factors), calculated data and estimates.

| Card | Basket | Basis |
|---|---|---|
| Our gas invoices for the ovens (m³ from our meter) | **Site-specific** | 3.2.3: measured at our own meter. "Primary" earns half points (50), because it isn't wrong, just less precise |
| Our electricity meter readings | **Site-specific** | 3.2.3 (half points for Primary) |
| Technician's refill log for our cold room (kg weighed) | **Site-specific** | 3.2.3, Annex C.4 (half points for Primary) |
| Fuel the courier actually burnt for us (its fuel logs) | **Primary** | 3.2.2: direct measurement, but collected outside our boundary (3.2.3) |
| Delta Mills' footprint per tonne of flour, from its own meters | **Primary** | 3.2.2 Note 1: a factor calculated from direct measurements is primary |
| Bag maker's measured energy per 1,000 bags | **Primary** | 3.2.2 / 3.2.3 |
| DESNZ conversion factor for diesel (2.66 kg CO₂e/L) | **Secondary** | 3.2.4: published database |
| Default fridge leak rate from IPCC guidelines | **Secondary** | 3.2.4, Annex C.5 ("default emission factors") |
| Average commute taken from a published study | **Secondary** | 3.2.4, Annex C.5 ("estimates") |

- **J15 Three baskets, but site-specific ⊂ primary.** ISO doesn't define three exclusive types: site-specific is a subset of primary. The game uses three baskets anyway, labelled "Site-specific (primary, inside our boundary)", "Primary (measured, but outside our boundary)" and "Secondary". That's why Primary on a site-specific card scores half. If you'd rather teach only primary vs secondary, change the three site-specific cards' `dtype` to `P` in `/admin`.
- **J16 Invoices = site-specific.** The instructor's framing "primary = from invoices" holds: a gas or electricity bill reports a meter reading at our own site. An *estimated* bill (no meter read) would not be a direct measurement.
- **J17 Conversion factors = secondary.** This matches "secondary = conversion/calculation": an emission factor taken from a database (DESNZ, IPCC) is secondary data, even though the litres it multiplies are primary.

---

## 1. Real-world numbers (cold open)

| Number shown | Value | Source | Status |
|---|---|---|---|
| Egypt GHG emissions 2023 | 335.968 Mt CO₂eq (shown as "336 Mt") | JRC/EDGAR 2024 booklet, Egypt page (PDF p. 114) | ✅ |
| Egypt per capita 2023 | 3.107 t CO₂eq/cap (shown as "3.1 t"; population 108.117 M) | same page | ✅ |
| Egypt transport, 2023 vs 1990 | **+221%** (all sectors +128%; power +299% is the only faster sector) | same page | ✅ |
| World total 2023 | 53.0 Gt CO₂eq (without LULUCF), +1.9% vs 2022 | EDGAR booklet, Key conclusions (PDF p. 8) | ✅ |
| World per capita 2023 | 6.59 t CO₂eq/cap | EDGAR booklet, PDF p. 17 | ✅ |

Wrong options on the cold-open question: 0.3 t, 13 t, 31 t (decimal-shift distractors).

## 2. Emission factors

| id | Factor | Value | Unit | Source | Status |
|---|---|---|---|---|---|
| `diesel` | Diesel (100% mineral diesel), combustion | **2.66155** | kg CO₂e / litre | UK DESNZ GHG Conversion Factors **2025**, Fuels › Liquid fuels | 🔎 |
| `grid_eg` | Egypt grid electricity, average | **0.381** | kg CO₂ / kWh | Egyptian Electricity Holding Company (EEHC) Annual Report 2024/2025: 380.86 t CO₂/GWh | 🔎 |
| `r134a` | HFC-134a GWP100 | **1,530** | kg CO₂e / kg | IPCC AR6 WG1 Ch. 7, Table 7.SM.7 | 🔎 (well known; DESNZ files use AR5 = 1,300) |
| `natgas` | Natural gas, stationary combustion (commercial/institutional table; the manufacturing table, CH₄ 1 kg/TJ, would give 56.16) | **56.276** | kg CO₂e / GJ (NCV) | IPCC 2006 Guidelines Vol. 2 Ch. 2 Table 2.4 (CO₂ 56,100; CH₄ 5; N₂O 0.1 kg/TJ) × AR6 GWP100 (CH₄ fossil 29.8; N₂O 273) | 🔎 |
| `van_tkm` | Diesel van, average up to 3.5 t, freight | **0.61643** | kg CO₂e / tonne·km | UK DESNZ GHG Conversion Factors **2024**, Freighting goods › Vans › Diesel | 🔎 (2024 edition; update to the current year) |
| `flight` | Flight, international to/from non-UK, economy, **without RF** | **0.0645** | kg CO₂e / passenger·km | UK DESNZ GHG Conversion Factors 2025, Business travel – air | 🔎 |
| `eeio_truck` | Spend-based: US trucking-industry factor, specialized freight trucking, local (NAICS 484220; 484110 or 492110 couriers would also fit) | **0.595** | kg CO₂e / USD (2022) | US EPA Supply Chain GHG Emission Factors v1.3 (with margins) | 🔎 |
| `fx` | Exchange rate for the spend-based method | **50** | EGP / USD | Game assumption (approx. 2025–26 rate) | judgment |
| `flour_pcf` | Flour cradle-to-gate footprint | **0.45** | kg CO₂e / kg | **Fictional** "Delta Mills" supplier declaration (story data, not a real factor) | fictional |

Where to verify:
- DESNZ 2025 flat file: gov.uk › "Greenhouse gas reporting: conversion factors 2025" (2026 set published 11 June 2026; consider updating to 2026).
- EEHC: Annual Report 2024/2025 (electricity sector CO₂ ÷ total generation).
- EPA v1.3: catalog.data.gov "Supply Chain Greenhouse Gas Emission Factors v1.3 by NAICS-6".

## 3. The answer keys for Chapter 3 (calculations)

Answers are in **tonnes CO₂e**. Players within ±5% get full points, within ±15% get partial points, and an answer 1,000× too big is flagged as a "kg instead of tonnes" slip.

| Evidence file | Activity data (fictional company data) | Formula | Answer |
|---|---|---|---|
| #1 Fuel card (own diesel vans, S1) | 18,000 L diesel | 18,000 × 2.66155 ÷ 1,000 | **47.9 t** |
| #2 Electricity bill (S2, location-based) | 380,000 + 40,000 + 15,000 (EV chargers) = 435,000 kWh | 435,000 × 0.381 ÷ 1,000 | **165.7 t CO₂** (≈ CO₂e, see J11) |
| #3 Refrigerant log (S1) | 14 + 16 + 12 = 42 kg R-134a topped up | 42 × 1,530 ÷ 1,000 | **64.3 t** |
| #4 Trip sheet (S3 Cat 6) | 6 travellers × return × 2,420 km (CAI–DXB great circle ≈ 2,416 km) | 29,040 p·km × 0.0645 ÷ 1,000 | **1.87 t** |
| Courier, fuel-based (S3 Cat 4) | 4,800 L diesel reported by the courier | 4,800 × 2.66155 ÷ 1,000 | **12.8 t** |
| Courier, distance-based | 26,000 tonne·km | 26,000 × 0.61643 ÷ 1,000 | **16.0 t** |
| Courier, spend-based | EGP 1,650,000 → USD 33,000 | 33,000 × 0.595 ÷ 1,000 | **19.6 t** |
| Pre-filled: oven gas (S1) | 2,400 GJ | 2,400 × 56.276 ÷ 1,000 | **135.1 t** |
| Pre-filled: purchased flour (S3 Cat 1) | 1,200 t flour | 1,200,000 kg × 0.45 ÷ 1,000 | **540.0 t** |

**Inventory total on the finale report:** S1 247.2 + S2 165.7 (location-based) + S3 554.6 = **967.6 t CO₂e**. Not quantified, and labelled as such on screen: commuting, the generator, packaging end-of-life, and other Scope 3 categories.

## 4. Answer keys for Chapters 1 and 2 (classification)

| Source | GHG Protocol | Basis | ISO 14064-1 (accepted) | Basis |
|---|---|---|---|---|
| Oven gas | S1 | Corporate Std Ch. 4 (stationary combustion) | 1 | B.2.2 a) |
| Own diesel vans | S1 | Table 5.7 row 1 / Table 6.1 row 1 | 1 | B.2.2 b), B.4.1 (owned transport → Cat 1) |
| Grid electricity | S2 | Corporate Std / Scope 2 Guidance | 2 | B.3.2 a) |
| Own EV vans charged at depot | S2 | Table 5.7 row 1 ("scope 2 for electricity use") | 2 | B.3.2 a) (see judgment J2) |
| Cold-room refrigerant leak | S1 | Corporate Std Ch. 4 (fugitive) | 1 | B.2.2 d) NOTE 2 |
| Leased vans operated by Nile Loaf | S3 **Cat 8** | Table 5.7 row 2 + Corporate Std leased-assets guidance (App. F); Table 6.1 row 4 (see J1) | 3 or 4 | B.4.1 + EXAMPLE, B.5.4 b) |
| Diesel backup generator | S1 | Corporate Std Ch. 4 (not in the deck) | 1 | B.2.1 (electricity generators), B.2.2 a) |
| Courier Nile Loaf pays (outbound) | S3 **Cat 4** | Table 5.7 row 7 (incl. outbound logistics purchased) | 3 | B.4.2 a) |
| Mill's truck delivering flour to us | S3 **Cat 4** | Table 5.7 row 6 (tier-1 supplier → own operations) | 3 | B.4.2 a) |
| Truck bringing wheat to the mill | S3 **Cat 1** | Table 5.7 row 3 (upstream of tier 1, inside cradle-to-gate) | 4 or 3 | B.5.1; B.4.2 a) option + Fig. B.1 |
| Manufacturing our new vans | S3 **Cat 2** | Table 5.7 row 4 | 4 | B.5.2 b) |
| Tanker delivering diesel to the depot | S3 **Cat 3** | Table 5.7 row 5 ("Transportation of fuels and energy consumed") | 3 or 4 | B.4.1 (fuel transportation) / B.5.2 a) |
| Staff flights to the trade fair | S3 **Cat 6** | Table 6.1 row 2 | 3 | B.4.2 e) |
| Staff commuting | S3 **Cat 7** | Table 6.1 row 3 | 3 | B.4.2 c) |
| App deliveries the customer pays for | S3 **Cat 9** | Table 5.7 row 8 ("if not paid for by the reporting company") | 3 | B.4.2 b) |
| Customers throwing away our bread bags | S3 **Cat 12** | Scope 3 Std Table 5.4 (not in the deck) | 5 | B.6.2 c) |

Eleven of the 16 Chapter 1 sources are transport cases from the deck's tables. Chapter 2 uses 8 of them, and **ISO round answers marked "or" all get full credit**.

## 5. Judgment calls (please confirm)

- **J1 Leased vans and the consolidation approach.** Nile Loaf is stated (on screen, in the board note) to use **financial control**, with the extra vans on a short **operating lease** that Nile Loaf drives. Under that approach the deck's Table 5.7 row 2 plus the GHG Protocol leased-assets guidance (Corporate Standard, Appendix F, not among the supplied PDFs) give Scope 3 Cat 8. The reveal text says explicitly that under **operational control** they would be Scope 1. In ISO, with financial control the fleet is **indirect**: B.4.1 allows Category 3 or the services category (B.5.3, i.e. Category 4), so both are accepted. Under operational control it would be Category 1.
- **J2 EV vans in ISO.** B.4.1 says owned transport goes to Category 1, but an EV has no direct emissions. Its emissions are from imported grid electricity, so the key is **Category 2**.
- **J3 Wheat truck in ISO.** B.5.1 puts transport between suppliers inside purchased goods (Category 4). B.4.2 a) also lets you report all supply-chain transport in Category 3. Both are accepted, and the wisdom card raises double counting (Fig. B.1).
- **J4 Diesel tanker.** GHG Protocol: Cat 3 per Table 5.7 row 5. ISO: Category 3 (B.4.1 includes "fuel transportation/distribution") or Category 4 (energy upstream, B.5.2 a)). Both are accepted.
- **J5 Packaging and the generator** are outside the deck (Corporate Std / Scope 3 Std Table 5.4). They're there as non-transport contrast and to give ISO Category 5 a case.
- **J6 Refrigerant.** AR6 GWP (1,530) as the brief requires. Screening assumption: top-up = leak.
- **J7 Flights** exclude radiative forcing (RF). The DESNZ factor already includes the 8% distance uplift, so great-circle distance is used.
- **J8 Spend-based** applies a **US 2022-dollar** EEIO factor to an Egyptian invoice at 50 EGP/USD, with no inflation or price-level adjustment. That is deliberate: it's the point of the "one trip, three methods" reveal. The inventory uses the **fuel-based** result (courier's own data).
- **J9 Scope 2 market-based.** Egypt has no published residual mix, so the game treats market-based = location-based unless a team buys the green contract, which sets market-based Scope 2 to 0. Location-based is unchanged, and Chapter 4 ranks teams on **location-based** reduction (both are shown).
- **J10 Chapter 4 model assumptions** (illustrative, editable in `boardModel`): diesel van 0.10 L/km (≈ 30,000 km/van/yr); EV 0.25 kWh/km, charged at the depot (the 15,000 kWh EV sub-meter = 2 EVs × 30,000 km); leak fix −80%; rooftop solar covers 25% of grid kWh; courier switch −60%; mill engagement cuts the flour footprint by 15% (0.45 → 0.3825). Commuting is unmeasured, so the shuttle shows no number on purpose.
- **J11 Egypt grid factor** is CO₂ only (EEHC), not CO₂e. The difference is small for a gas-fired grid; noted on the factor card.
- **J12 Nile Loaf, its suppliers, documents and quantities are fictional.** No real company names or logos are used.

- **J13 Egypt grid factor scope.** Verify that EEHC's 380.86 t CO₂/GWh is per kWh *generated* (no T&D-loss adjustment). The game uses it as a consumption factor.
- **J14 Independent review (done).** An independent reviewer checked every answer key, the scope↔ISO mapping and this file against the PDFs. It found no wrong answer keys. Citation and wording fixes (Table 5.7 row numbers 6/7/8, ISO insight wording, leased-assets citation, EV sub-meter consistency, etc.) have been applied. See TESTING.md.

## 6. Scoring (for transparency)

- Classification: 100 points for the right scope or ISO category, plus up to 20 for speed, plus 50 for the right Scope 3 category (bonus).
- Cold open: 50. Calculations: 200 within ±5% (plus up to 30 for speed), 50 within ±15%.
- Team score = the team's average player score + Chapter 4 bonus (300/200/100 for the three biggest location-based cuts).
- **Nothing scores until the Chief Auditor presses Confirm.**

---
Sign-off: ______________________ (Chief Auditor) Date: __________
