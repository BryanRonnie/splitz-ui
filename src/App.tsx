import { useState } from 'react'
import FileDropzone from './components/FileDropzone'
import './index.css'

type Stage = 'upload' | 'review'

type Taxable = 'TAXABLE' | 'NON_TAXABLE' | 'UNKNOWN'

type ExtractResponse = {
  success: boolean
  receipt: {
    receipt_id: string
    line_items: Array<{
      item_id: string
      name_raw: string
      name_normalized: string | null
      quantity: number
      unit_price: number
      line_subtotal: number
      taxable: Taxable
      tax_amount: number | null
    }>
    fees: Array<{
      fee_id: string
      type: string
      amount: number
      taxable: Taxable
      tax_amount: number | null
    }>
    discounts: Array<{
      discount_id: string
      description: string | null
      type: string | null
      amount: number
      taxable: Taxable
      tax_impact: number | null
    }>
    subtotal_items: number
    total_fees: number
    total_discount: number
    total_tax_reported: number | null
    total_tax_calculated: number | null
    grand_total: number
    status: 'EXTRACTED' | 'NEEDS_REVIEW' | 'FINAL'
  }
  errors: string[]
}

function App() {
  const [itemsFiles, setItemsFiles] = useState<File[]>([])
  const [chargesFiles, setChargesFiles] = useState<File[]>([])
  const [stage, setStage] = useState<Stage>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ExtractResponse['receipt'] | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [editedItems, setEditedItems] = useState<Record<string, { quantity: number; price: number; taxable: boolean }>>({})
  const [editedFees, setEditedFees] = useState<Record<string, { quantity: number; price: number; taxable: boolean }>>({})
  const [editedDiscount, setEditedDiscount] = useState<{ quantity: number; price: number; taxable: boolean } | null>(null)

  const updateItemEdit = (itemId: string, field: 'quantity' | 'price' | 'taxable', value: number | boolean) => {
    setEditedItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }))
  }

  const updateFeeEdit = (feeId: string, field: 'quantity' | 'price' | 'taxable', value: number | boolean) => {
    setEditedFees(prev => ({
      ...prev,
      [feeId]: {
        ...prev[feeId],
        [field]: value
      }
    }))
  }

  const updateDiscountEdit = (field: 'quantity' | 'price' | 'taxable', value: number | boolean) => {
    setEditedDiscount(prev => ({
      ...prev,
      [field]: value
    } as any))
  }

  const getItemValue = (item: ExtractResponse['receipt']['line_items'][0], field: 'quantity' | 'price' | 'taxable') => {
    const edited = editedItems[item.item_id]
    if (field === 'quantity') return edited?.quantity ?? item.quantity
    if (field === 'price') return edited?.price ?? item.line_subtotal
    if (field === 'taxable') return edited?.taxable ?? item.taxable === 'TAXABLE'
    return null
  }

  const getFeeValue = (feeId: string, field: 'quantity' | 'price' | 'taxable', defaultPrice: number, defaultTaxable: boolean) => {
    const edited = editedFees[feeId]
    if (field === 'quantity') return edited?.quantity ?? 0
    if (field === 'price') return edited?.price ?? defaultPrice
    if (field === 'taxable') return edited?.taxable ?? defaultTaxable
    return null
  }

  const getDiscountValue = (field: 'quantity' | 'price' | 'taxable', defaultPrice: number) => {
    if (field === 'quantity') return editedDiscount?.quantity ?? 0
    if (field === 'price') return editedDiscount?.price ?? defaultPrice
    if (field === 'taxable') return editedDiscount?.taxable ?? false
    return null
  }

  const handleItemsFiles = (files: File[]) => {
    setItemsFiles(prev => [...prev, ...files])
  }

  const handleChargesFiles = (files: File[]) => {
    setChargesFiles(files.slice(0, 1)) // Only keep first file
  }

  const removeItemsFile = (index: number) => {
    setItemsFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeChargesFile = (index: number) => {
    setChargesFiles(prev => prev.filter((_, i) => i !== index))
  }

  const canProcess = itemsFiles.length > 0 && chargesFiles.length > 0

  const handleProcess = async () => {
    if (!canProcess) return
    setLoading(true)
    setError(null)
    setReceipt(null)

    const formData = new FormData()
    itemsFiles.forEach(file => formData.append('items_images', file))
    formData.append('charges_image', chargesFiles[0])

    try {
      const resp = await fetch('http://127.0.0.1:8000/extract_receipt/extract-receipt-multipart-gemini', {
        method: 'POST',
        body: formData,
      })

      if (!resp.ok) {
        let msg = 'Failed to extract receipt'
        try {
          const err = await resp.json()
          msg = err.detail || msg
        } catch {}
        throw new Error(msg)
      }

      const data = (await resp.json()) as ExtractResponse
      if (!data.success) {
        throw new Error(data.errors?.join(', ') || 'Extraction failed')
      }

      console.log('📦 Raw receipt from backend:', data.receipt)
      console.log('   subtotal_items:', data.receipt.subtotal_items)
      console.log('   total_tax_reported:', data.receipt.total_tax_reported)
      console.log('   total_tax_calculated:', data.receipt.total_tax_calculated)
      console.log('   total_fees:', data.receipt.total_fees)
      console.log('   total_discount:', data.receipt.total_discount)
      console.log('   grand_total:', data.receipt.grand_total)

      setReceipt(data.receipt)
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  const renderUpload = () => (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Splitz</h1>
        <p className="text-muted-foreground">Upload your receipt images to get started</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-card rounded-xl border shadow-sm p-6">
          <FileDropzone
            title="Items & Prices"
            description="Upload one or more images showing item names and prices"
            files={itemsFiles}
            onFilesAccepted={handleItemsFiles}
            onRemoveFile={removeItemsFile}
            multiple={true}
          />
        </div>

        <div className="bg-card rounded-xl border shadow-sm p-6">
          <FileDropzone
            title="Charges & Fees"
            description="Upload a single image showing additional charges, taxes, and fees"
            files={chargesFiles}
            onFilesAccepted={handleChargesFiles}
            onRemoveFile={removeChargesFile}
            multiple={false}
          />
        </div>
      </div>

      {canProcess && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleProcess}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? 'Processing…' : 'Process Receipt'}
          </button>
        </div>
      )}
    </div>
  )

  const renderReview = () => {
    if (!receipt) {
      return (
        <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
          <button
            onClick={() => setStage('upload')}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            ← Back
          </button>
          <div className="bg-card border rounded-xl p-6">
            <p className="text-muted-foreground">No receipt data yet. Upload images and process to view results.</p>
          </div>
        </div>
      )
    }

    const items = receipt.line_items || []
    const itemsSubtotal = receipt.subtotal_items ?? items.reduce((sum, item) => sum + (item.line_subtotal ?? 0), 0)
    const feesTotal = receipt.total_fees ?? receipt.fees?.reduce((sum, fee) => sum + (fee.amount ?? 0), 0) ?? 0
    const discountsTotal = receipt.total_discount ?? receipt.discounts?.reduce((sum, disc) => sum + (disc.amount ?? 0), 0) ?? 0
    const taxTotal = receipt.total_tax_reported ?? receipt.total_tax_calculated ?? 0
    const grandTotal = receipt.grand_total ?? itemsSubtotal + feesTotal + taxTotal - discountsTotal
    
    // Extract individual fees
    const serviceFee = receipt.fees?.find(f => f.type === 'SERVICE') ?? null
    const bagFee = receipt.fees?.find(f => f.type === 'BAG') ?? null
    const discount = receipt.discounts?.[0] ?? null

    // Calculate totals based on edited values
    const calculatedItemsSubtotal = items.reduce((sum, item) => {
      const price = getItemValue(item, 'price') as number
      return sum + price
    }, 0)

    const calculatedItemsTax = items.reduce((sum, item) => {
      const price = getItemValue(item, 'price') as number
      const isTaxable = getItemValue(item, 'taxable') as boolean
      return sum + (isTaxable ? price * 0.13 : 0)
    }, 0)

    const calculatedBagFeePrice = getFeeValue(bagFee?.fee_id || 'bag', 'price', bagFee?.amount ?? 0, bagFee?.taxable === 'TAXABLE') as number
    const calculatedBagFeeTaxable = getFeeValue(bagFee?.fee_id || 'bag', 'taxable', bagFee?.amount ?? 0, bagFee?.taxable === 'TAXABLE') as boolean
    const calculatedBagFeeTax = calculatedBagFeeTaxable ? calculatedBagFeePrice * 0.13 : 0

    const calculatedServiceFeePrice = getFeeValue(serviceFee?.fee_id || 'service', 'price', serviceFee?.amount ?? 0, serviceFee?.taxable === 'TAXABLE') as number
    const calculatedServiceFeeTaxable = getFeeValue(serviceFee?.fee_id || 'service', 'taxable', serviceFee?.amount ?? 0, serviceFee?.taxable === 'TAXABLE') as boolean
    const calculatedServiceFeeTax = calculatedServiceFeeTaxable ? calculatedServiceFeePrice * 0.13 : 0

    const calculatedDiscountPrice = getDiscountValue('price', discount?.amount ?? 0) as number
    const calculatedDiscountTaxable = getDiscountValue('taxable', discount?.amount ?? 0) as boolean
    const calculatedDiscountTax = calculatedDiscountTaxable ? calculatedDiscountPrice * 0.13 : 0

    const calculatedGrandTotal = calculatedItemsSubtotal + calculatedItemsTax + 
                                 calculatedBagFeePrice + calculatedBagFeeTax + 
                                 calculatedServiceFeePrice + calculatedServiceFeeTax - 
                                 calculatedDiscountPrice - calculatedDiscountTax

    // Comparison with tolerance of 0.02 for rounding
    const tolerance = 0.02
    const itemsSubtotalMatch = Math.abs(calculatedItemsSubtotal - itemsSubtotal) < tolerance
    const itemsTaxMatch = Math.abs(calculatedItemsTax - taxTotal) < tolerance
    const itemsTotalMatch = Math.abs((calculatedItemsSubtotal + calculatedItemsTax) - (itemsSubtotal + taxTotal)) < tolerance
    const grandTotalMatch = Math.abs(calculatedGrandTotal - grandTotal) < tolerance

    console.log('💰 Calculated totals:')
    console.log('   itemsSubtotal:', itemsSubtotal)
    console.log('   feesTotal:', feesTotal)
    console.log('   discountsTotal:', discountsTotal)
    console.log('   taxTotal:', taxTotal)
    console.log('   grandTotal:', grandTotal)

    const summaryRows = [
      { label: 'Items Subtotal', amount: itemsSubtotal, hstAmount: taxTotal },
      { label: 'Fees', amount: feesTotal, hstAmount: 0 },
      { label: 'Discounts', amount: -discountsTotal, hstAmount: 0 },
      { label: 'Total', amount: grandTotal, hstAmount: taxTotal },
    ]

    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStage('upload')}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            ← Back
          </button>
          <div className="text-right">
            <h2 className="text-2xl font-semibold">Receipt Details</h2>
            <p className="text-sm text-muted-foreground">Review extracted items and taxes</p>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors text-muted-foreground"
          >
            {showDebug ? '🔍 Hide' : '🔍 Debug'}
          </button>
        </div>

        {showDebug && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-xs font-mono overflow-auto max-h-48">
            <pre>{JSON.stringify({
              subtotal_items: receipt.subtotal_items,
              total_tax_reported: receipt.total_tax_reported,
              total_tax_calculated: receipt.total_tax_calculated,
              total_fees: receipt.total_fees,
              total_discount: receipt.total_discount,
              grand_total: receipt.grand_total,
              line_items_count: receipt.line_items?.length,
              fees_count: receipt.fees?.length,
              discounts_count: receipt.discounts?.length,
            }, null, 2)}</pre>
          </div>
        )}

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Item Name</th>
                  <th className="px-3 py-3 text-left font-semibold">Qty</th>
                  <th className="px-3 py-3 text-left font-semibold">Price</th>
                  <th className="px-3 py-3 text-left font-semibold">HST?</th>
                  <th className="px-3 py-3 text-left font-semibold">HST (13%)</th>
                  <th className="px-3 py-3 text-left font-semibold">Price incl Tax</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const quantity = getItemValue(item, 'quantity') as number
                  const price = getItemValue(item, 'price') as number
                  const isTaxable = getItemValue(item, 'taxable') as boolean
                  const hstAmount = isTaxable ? (price * 0.13) : 0
                  const total = price + hstAmount
                  return (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 align-center">{item.name_normalized || item.name_raw}</td>
                      <td className="px-3 py-2 align-center">
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => updateItemEdit(item.item_id, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-12 px-2 py-1 border rounded"
                          step="0.01"
                          min="0"
                        />
                      </td>
                      <td className="px-3 py-2 align-center">
                        <input
                          type="number"
                          value={price.toFixed(2)}
                          onChange={(e) => updateItemEdit(item.item_id, 'price', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border rounded"
                          step="0.01"
                          min="0"
                        />
                      </td>
                      <td className="px-3 py-2 align-center">
                        <input
                          type="checkbox"
                          checked={isTaxable}
                          onChange={(e) => updateItemEdit(item.item_id, 'taxable', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2 align-center">{isTaxable ? `$${hstAmount.toFixed(2)}` : ''}</td>
                      <td className="px-3 py-2 align-center">${total.toFixed(2)}</td>
                    </tr>
                  )
                })}
                {/* Items Subtotal row */}
                <tr className="bg-black text-white font-semibold border-t-2">
                  <td className="px-3 py-2">Items Subtotal</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2" style={{ color: itemsSubtotalMatch ? '#22c55e' : '#ef4444' }} title={!itemsSubtotalMatch ? `Detected: $${itemsSubtotal.toFixed(2)}` : undefined}>
                    ${calculatedItemsSubtotal.toFixed(2)}
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2" >
                    ${calculatedItemsTax.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    ${(calculatedItemsSubtotal + calculatedItemsTax).toFixed(2)}
                  </td>
                </tr>
                {/* Checkout Bag Fee row */}
                <tr className="border-t bg-muted/20">
                  <td className="px-3 py-2">Checkout Bag Fee</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={(getFeeValue(bagFee?.fee_id || 'bag', 'price', bagFee?.amount ?? 0, bagFee?.taxable === 'TAXABLE') as number).toFixed(2)}
                      onChange={(e) => updateFeeEdit(bagFee?.fee_id || 'bag', 'price', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={getFeeValue(bagFee?.fee_id || 'bag', 'taxable', bagFee?.amount ?? 0, bagFee?.taxable === 'TAXABLE') as boolean}
                      onChange={(e) => updateFeeEdit(bagFee?.fee_id || 'bag', 'taxable', e.target.checked)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {(getFeeValue(bagFee?.fee_id || 'bag', 'taxable', bagFee?.amount ?? 0, bagFee?.taxable === 'TAXABLE') as boolean) ? `$${((getFeeValue(bagFee?.fee_id || 'bag', 'price', bagFee?.amount ?? 0, bagFee?.taxable === 'TAXABLE') as number) * 0.13).toFixed(2)}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    ${((getFeeValue(bagFee?.fee_id || 'bag', 'price', bagFee?.amount ?? 0, bagFee?.taxable === 'TAXABLE') as number) + ((getFeeValue(bagFee?.fee_id || 'bag', 'taxable', bagFee?.amount ?? 0, bagFee?.taxable === 'TAXABLE') as boolean) ? ((getFeeValue(bagFee?.fee_id || 'bag', 'price', bagFee?.amount ?? 0, bagFee?.taxable === 'TAXABLE') as number) * 0.13) : 0)).toFixed(2)}
                  </td>
                </tr>
                {/* Service Fee row */}
                <tr className="border-t bg-muted/20">
                  <td className="px-3 py-2">Service Fee</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={(getFeeValue(serviceFee?.fee_id || 'service', 'price', serviceFee?.amount ?? 0, serviceFee?.taxable === 'TAXABLE') as number).toFixed(2)}
                      onChange={(e) => updateFeeEdit(serviceFee?.fee_id || 'service', 'price', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={getFeeValue(serviceFee?.fee_id || 'service', 'taxable', serviceFee?.amount ?? 0, serviceFee?.taxable === 'TAXABLE') as boolean}
                      onChange={(e) => updateFeeEdit(serviceFee?.fee_id || 'service', 'taxable', e.target.checked)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {(getFeeValue(serviceFee?.fee_id || 'service', 'taxable', serviceFee?.amount ?? 0, serviceFee?.taxable === 'TAXABLE') as boolean) ? `$${((getFeeValue(serviceFee?.fee_id || 'service', 'price', serviceFee?.amount ?? 0, serviceFee?.taxable === 'TAXABLE') as number) * 0.13).toFixed(2)}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    ${((getFeeValue(serviceFee?.fee_id || 'service', 'price', serviceFee?.amount ?? 0, serviceFee?.taxable === 'TAXABLE') as number) + ((getFeeValue(serviceFee?.fee_id || 'service', 'taxable', serviceFee?.amount ?? 0, serviceFee?.taxable === 'TAXABLE') as boolean) ? ((getFeeValue(serviceFee?.fee_id || 'service', 'price', serviceFee?.amount ?? 0, serviceFee?.taxable === 'TAXABLE') as number) * 0.13) : 0)).toFixed(2)}
                  </td>
                </tr>
                {/* Discount row */}
                <tr className="border-t bg-muted/20">
                  <td className="px-3 py-2">Discount(if any)</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={(getDiscountValue('price', discount?.amount ?? 0) as number).toFixed(2)}
                      onChange={(e) => updateDiscountEdit('price', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={getDiscountValue('taxable', discount?.amount ?? 0) as boolean}
                      onChange={(e) => updateDiscountEdit('taxable', e.target.checked)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {(getDiscountValue('taxable', discount?.amount ?? 0) as boolean) ? `$${((getDiscountValue('price', discount?.amount ?? 0) as number) * 0.13).toFixed(2)}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    -${((getDiscountValue('price', discount?.amount ?? 0) as number) + ((getDiscountValue('taxable', discount?.amount ?? 0) as boolean) ? ((getDiscountValue('price', discount?.amount ?? 0) as number) * 0.13) : 0)).toFixed(2)}
                  </td>
                </tr>
                {/* Price Adjustments row */}
                <tr className="border-t bg-muted/20">
                  <td className="px-3 py-2">Price Adjustments(if any)</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                </tr>
                {/* Total row */}
                <tr className="bg-black text-white font-semibold border-t-2">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2" style={{ color: grandTotalMatch ? '#22c55e' : '#ef4444' }} title={!grandTotalMatch ? `Detected: $${grandTotal.toFixed(2)}` : undefined}>
                    ${calculatedGrandTotal.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {stage === 'upload' ? renderUpload() : renderReview()}
    </div>
  )
}

export default App
