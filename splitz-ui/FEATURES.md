# Splitz UI - Feature Summary

## ✅ Completed Features

### 1. **Fee & Adjustments Management**
- Add custom fees (Bag Fee, Service Fee, Discounts, Price Adjustments, etc.)
- Toggle HST (13%) on individual fees
- Delete fees with one click
- Fees automatically split among all people (or selectively if configured)

**How to use:**
- Desktop: Click "+ Add Fee or Adjustment" button in the table
- Mobile: Click "+ Add Fee" card button
- Enter fee name, amount, and HST preference
- Fees appear in table with calculations per person

### 2. **Subtotals & Grand Total**
- **Items Subtotal**: Automatically calculated sum of all items with HST
- **Fees Total**: Sum of all fees with HST applied
- **Grand Total**: Items + Fees shown in highlighted green footer row

**Desktop view:**
- Items subtotal shows after all items
- Each fee row shows split per person
- Grand total row at bottom with per-person breakdown

### 3. **Per-Person Breakdown**
- Top summary section shows "Grand Total" and "{Name} Pays" for each person
- Each person's total includes:
  - Their share of items they're assigned to
  - Their share of fees (evenly split)
- Updated in real-time as items/fees are added/removed

### 4. **CSV Export**
- Click **"Export CSV"** button to download spreadsheet
- File format:
  - Headers: Item Name, Qty, Price, HST?, HST Amount, Price incl Tax, [Person Names], [Person Pays]
  - Item rows with qty/price/assignments
  - Fee rows with amounts and per-person splits
  - Grand totals

**Usage:**
1. Click "Export CSV" button in header
2. File downloads as `splitz-YYYY-MM-DD.csv`
3. Open in Excel or any spreadsheet app

### 5. **CSV Import**
- Click **"Import CSV"** button to upload a file
- Parses CSV headers to match person names
- Automatically loads items and assignments
- Validates data before importing

**Usage:**
1. Click "Import CSV" button
2. Select a CSV file in the format exported by Splitz
3. Items automatically populate from the file

---

## 📊 Data Structure

### Items
- **Fields**: name, qty, price, hst (checkbox), person assignments
- **Tax**: 13% HST applied when checked
- **Assignments**: Select which people share this item

### Fees & Adjustments
- **Fields**: name, amount, hst (checkbox)
- **Split**: Automatically divided equally among all people
- **Tax**: 13% HST applied when checked (optional)

### People
- **Manage**: Go to "Manage People" page
- **Add**: Enter name, auto-generates contrast-safe color
- **Edit**: Click "Edit" to rename inline
- **Delete**: Click "Delete" with confirmation

---

## 🎨 UI Highlights

### Mobile View
- Stacked cards for each item
- Separate fees section
- Easy-to-tap checkboxes
- Full-width forms

### Desktop View
- Complete table with all calculations
- Inline editing for all fields
- Subtotal and fee rows
- Color-coded person columns
- Grand total footer in green

### Accessibility
- High contrast text colors
- Color-blind safe color generation
- Keyboard navigation support
- Clear visual hierarchy

---

## 💾 Data Persistence

Currently, data is stored in browser's React state and resets on page reload.

**To add persistence:**
1. Add localStorage integration
2. Connect to a backend database
3. Implement cloud sync

---

## 🚀 Next Steps

Potential enhancements:
- [ ] Item deletion/editing
- [ ] Fee assignment (select who pays)
- [ ] Payment settlement calculator
- [ ] PDF export
- [ ] Cloud sync with Firestore
- [ ] Mobile app version
- [ ] Receipt scanning
- [ ] Currency selection
