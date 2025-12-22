import { useState } from 'react'
import FileDropzone from './components/FileDropzone'
import './index.css'

type Stage = 'upload' | 'review' | 'split'

type Person = {
  id: string
  name: string
}

//

type ExtractResponse = {
  success: boolean
  receipt: {
    receipt_id: string
    vendor: string
    transaction_date: string | null
    extracted_at: string
    raw_ocr_text: {
      items: string
      charges: string
    }
    line_items: Array<{
      name_raw: string
      quantity: number
      unit_price: number
      line_subtotal: number
    }>
    fees: Array<{
      type: string
      amount: number
    }>
    discounts: Array<{
      description: string
      amount: number
    }>
    subtotal_items: number
    total_tax_reported: number | null
    grand_total: number
    status: string
    filename: string
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
  const [people, setPeople] = useState<Person[]>([])
  const [newPersonName, setNewPersonName] = useState('')
  const [itemAssignments, setItemAssignments] = useState<Record<string, Set<string>>>({})
  const [unequalSplits, setUnequalSplits] = useState<Record<string, Record<string, number>>>({})
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

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
    const edited = editedItems[item.name_raw]
    if (field === 'quantity') return edited?.quantity ?? item.quantity ?? 0
    if (field === 'price') return edited?.price ?? item.line_subtotal ?? 0
    if (field === 'taxable') return edited?.taxable ?? false
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

  const addPerson = () => {
    if (newPersonName.trim()) {
      setPeople([...people, { id: Date.now().toString(), name: newPersonName }])
      setNewPersonName('')
    }
  }

  const removePerson = (id: string) => {
    setPeople(people.filter(p => p.id !== id))
  }

  const updatePersonName = (id: string, name: string) => {
    setPeople(people.map(p => p.id === id ? { ...p, name } : p))
  }

  const toggleItemAssignment = (itemName: string, personId: string) => {
    setItemAssignments(prev => {
      const current = prev[itemName] || new Set()
      const updated = new Set(current)
      if (updated.has(personId)) {
        updated.delete(personId)
      } else {
        updated.add(personId)
      }
      return {
        ...prev,
        [itemName]: updated
      }
    })
  }

  const isItemAssignedToPerson = (itemName: string, personId: string) => {
    return itemAssignments[itemName]?.has(personId) || false
  }

  const setUnequalSplitValue = (itemName: string, personId: string, value: number) => {
    setUnequalSplits(prev => ({
      ...prev,
      [itemName]: {
        ...prev[itemName],
        [personId]: value
      }
    }))
  }

  const getPersonItemTotal = (personId: string) => {
    let total = 0
    const items = receipt?.line_items || []
    items.forEach(item => {
      if (isItemAssignedToPerson(item.name_raw, personId)) {
        const price = getItemValue(item, 'price') as number
        const isTaxable = getItemValue(item, 'taxable') as boolean
        const hstAmount = isTaxable ? (price * 0.13) : 0
        const unequalValue = unequalSplits[item.name_raw]?.[personId]
        total += unequalValue !== undefined ? unequalValue : (price + hstAmount)
      }
    })
    return total
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

  const handleProcess = async (preserveReceipt: boolean = false) => {
    if (!canProcess) return
    setLoading(true)
    setError(null)
    if (!preserveReceipt) {
      setReceipt(null)
    }

    const formData = new FormData()
    itemsFiles.forEach(file => formData.append('items_images', file))
    formData.append('charges_image', chargesFiles[0])

    try {
      const resp = await fetch('http://127.0.0.1:8000/extract_receipt/extract-receipt', {
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
            onClick={() => handleProcess()}
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
    const itemsSubtotal = receipt.subtotal_items
    const feesTotal = receipt.fees?.reduce((sum, fee) => sum + (fee.amount ?? 0), 0) ?? 0
    const discountsTotal = receipt.discounts?.reduce((sum, disc) => sum + (disc.amount ?? 0), 0) ?? 0
    const taxTotal = receipt.total_tax_reported ?? 0
    const grandTotal = receipt.grand_total

    // Extract individual fees
    const serviceFee = receipt.fees?.find(f => f.type.includes('Service Fee') && !f.type.includes('Tax')) ?? null
    const serviceFeeData = serviceFee ? { fee_id: 'service', ...serviceFee, taxable: true, tax_amount: receipt.fees?.find(f => f.type === 'Service Fee Tax')?.amount ?? 0 } : { fee_id: 'service', type: 'Service Fee', amount: 0, taxable: true, tax_amount: 0 }
    
    const bagFee = receipt.fees?.find(f => f.type.includes('Bag Fee') && !f.type.includes('Tax')) ?? null
    const bagFeeData = bagFee ? { fee_id: 'bag', ...bagFee, taxable: true, tax_amount: receipt.fees?.find(f => f.type === 'Checkout Bag Fee Tax')?.amount ?? 0 } : { fee_id: 'bag', type: 'Checkout Bag Fee', amount: 0, taxable: true, tax_amount: 0 }
    
    const discount = receipt.discounts?.[0] ?? null

    const calculatedItemsSubtotal = items.reduce((sum, item) => {
      if (item.line_subtotal === null) return sum
      const price = getItemValue(item, 'price') as number
      return sum + price
    }, 0)

    const calculatedItemsTax = items.reduce((sum, item) => {
      if (item.line_subtotal === null) return sum
      const price = getItemValue(item, 'price') as number
      const isTaxable = getItemValue(item, 'taxable') as boolean
      return sum + (isTaxable ? price * 0.13 : 0)
    }, 0)

    const calculatedBagFeePrice = getFeeValue(bagFeeData?.fee_id || 'bag', 'price', bagFeeData?.amount ?? 0, true) as number
    const calculatedBagFeeTaxable = getFeeValue(bagFeeData?.fee_id || 'bag', 'taxable', bagFeeData?.amount ?? 0, true) as boolean
    const calculatedBagFeeTax = calculatedBagFeeTaxable ? calculatedBagFeePrice * 0.13 : 0

    const calculatedServiceFeePrice = getFeeValue(serviceFeeData?.fee_id || 'service', 'price', serviceFeeData?.amount ?? 0, true) as number
    const calculatedServiceFeeTaxable = getFeeValue(serviceFeeData?.fee_id || 'service', 'taxable', serviceFeeData?.amount ?? 0, true) as boolean
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
    const grandTotalMatch = Math.abs(calculatedGrandTotal - grandTotal) < tolerance

    console.log('💰 Calculated totals:')
    console.log('   itemsSubtotal:', itemsSubtotal)
    console.log('   feesTotal:', feesTotal)
    console.log('   discountsTotal:', discountsTotal)
    console.log('   taxTotal:', taxTotal)
    console.log('   grandTotal:', grandTotal)

    //

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
          <div className="flex gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors text-muted-foreground"
            >
              {showDebug ? '🔍 Hide' : '🔍 Debug'}
            </button>
            <button
              onClick={() => handleProcess(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors text-muted-foreground disabled:opacity-60"
              title="Retry receipt extraction"
            >
              {loading ? 'Retrying…' : 'Retry'}
            </button>
            <button
              onClick={() => setStage('split')}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Split →
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {showDebug && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-xs font-mono overflow-auto max-h-48">
            <pre>{JSON.stringify({
              subtotal_items: receipt.subtotal_items,
              total_tax_reported: receipt.total_tax_reported,
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
                  const hasValidData = item.quantity !== null && item.line_subtotal !== null
                  const quantity = getItemValue(item, 'quantity') as number
                  const price = getItemValue(item, 'price') as number
                  const isTaxable = getItemValue(item, 'taxable') as boolean
                  const hstAmount = isTaxable ? (price * 0.13) : 0
                  const total = price + hstAmount
                  return (
                    <tr key={idx} className={`border-t ${!hasValidData ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2 align-center">{item.name_raw}</td>
                      <td className="px-3 py-2 align-center">
                        <input
                          type="number"
                          value={quantity || ''}
                          onChange={(e) => updateItemEdit(item.name_raw, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-12 px-2 py-1 border rounded"
                          step="0.01"
                          min="0"
                          placeholder={quantity === 0 ? 'null' : ''}
                        />
                      </td>
                      <td className="px-3 py-2 align-center">
                        <input
                          type="number"
                          value={price ? price.toFixed(2) : ''}
                          onChange={(e) => updateItemEdit(item.name_raw, 'price', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border rounded"
                          step="0.01"
                          min="0"
                          placeholder={price === 0 ? 'null' : ''}
                        />
                      </td>
                      <td className="px-3 py-2 align-center">
                        <input
                          type="checkbox"
                          checked={isTaxable}
                          onChange={(e) => updateItemEdit(item.name_raw, 'taxable', e.target.checked)}
                          className="w-4 h-4"
                          disabled={!hasValidData}
                        />
                      </td>
                      <td className="px-3 py-2 align-center">{isTaxable && hasValidData ? `$${hstAmount.toFixed(2)}` : '-'}</td>
                      <td className="px-3 py-2 align-center">{hasValidData ? `$${total.toFixed(2)}` : '-'}</td>
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
                      value={(getFeeValue(bagFeeData?.fee_id || 'bag', 'price', bagFeeData?.amount ?? 0, true) as number).toFixed(2)}
                      onChange={(e) => updateFeeEdit(bagFeeData?.fee_id || 'bag', 'price', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={getFeeValue(bagFeeData?.fee_id || 'bag', 'taxable', bagFeeData?.amount ?? 0, true) as boolean}
                      onChange={(e) => updateFeeEdit(bagFeeData?.fee_id || 'bag', 'taxable', e.target.checked)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {(getFeeValue(bagFeeData?.fee_id || 'bag', 'taxable', bagFeeData?.amount ?? 0, true) as boolean) ? `$${((getFeeValue(bagFeeData?.fee_id || 'bag', 'price', bagFeeData?.amount ?? 0, true) as number) * 0.13).toFixed(2)}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    ${((getFeeValue(bagFeeData?.fee_id || 'bag', 'price', bagFeeData?.amount ?? 0, true) as number) + ((getFeeValue(bagFeeData?.fee_id || 'bag', 'taxable', bagFeeData?.amount ?? 0, true) as boolean) ? ((getFeeValue(bagFeeData?.fee_id || 'bag', 'price', bagFeeData?.amount ?? 0, true) as number) * 0.13) : 0)).toFixed(2)}
                  </td>
                </tr>
                {/* Service Fee row */}
                <tr className="border-t bg-muted/20">
                  <td className="px-3 py-2">Service Fee</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={(getFeeValue(serviceFeeData?.fee_id || 'service', 'price', serviceFeeData?.amount ?? 0, true) as number).toFixed(2)}
                      onChange={(e) => updateFeeEdit(serviceFeeData?.fee_id || 'service', 'price', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded"
                      step="0.01"
                      min="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={getFeeValue(serviceFeeData?.fee_id || 'service', 'taxable', serviceFeeData?.amount ?? 0, true) as boolean}
                      onChange={(e) => updateFeeEdit(serviceFeeData?.fee_id || 'service', 'taxable', e.target.checked)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {(getFeeValue(serviceFeeData?.fee_id || 'service', 'taxable', serviceFeeData?.amount ?? 0, true) as boolean) ? `$${((getFeeValue(serviceFeeData?.fee_id || 'service', 'price', serviceFeeData?.amount ?? 0, true) as number) * 0.13).toFixed(2)}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    ${((getFeeValue(serviceFeeData?.fee_id || 'service', 'price', serviceFeeData?.amount ?? 0, true) as number) + ((getFeeValue(serviceFeeData?.fee_id || 'service', 'taxable', serviceFeeData?.amount ?? 0, true) as boolean) ? ((getFeeValue(serviceFeeData?.fee_id || 'service', 'price', serviceFeeData?.amount ?? 0, true) as number) * 0.13) : 0)).toFixed(2)}
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

  const renderSplit = () => {
    if (!receipt) {
      return (
        <div className="container mx-auto px-4 py-6 max-w-6xl space-y-4">
          <button
            onClick={() => setStage('review')}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            ← Back
          </button>
          <div className="bg-card border rounded-xl p-6">
            <p className="text-muted-foreground">No receipt data yet.</p>
          </div>
        </div>
      )
    }

    const items = receipt.line_items || []

    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStage('review')}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            ← Back
          </button>
          <div className="text-right">
            <h2 className="text-2xl font-semibold">Split Receipt</h2>
            <p className="text-sm text-muted-foreground">Assign items to people</p>
          </div>
        </div>

        {/* People Management Section */}
        <div className="bg-card border rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Participants</h3>
          <div className="space-y-3">
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={person.name}
                  onChange={(e) => updatePersonName(person.id, e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  placeholder="Person name"
                />
                <button
                  onClick={() => removePerson(person.id)}
                  className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPerson()}
                className="flex-1 px-3 py-2 border rounded-lg"
                placeholder="Add new person..."
              />
              <button
                onClick={addPerson}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Add Person
              </button>
            </div>
          </div>
        </div>

        {/* Items Split Table */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold min-w-40">Item Name</th>
                  <th className="px-3 py-3 text-left font-semibold">Qty</th>
                  <th className="px-3 py-3 text-left font-semibold">Price</th>
                  {people.map((person) => (
                    <th key={person.id} className="px-3 py-3 text-center font-semibold min-w-20">
                      {person.name}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold w-10">⚙️</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(item => item.line_subtotal !== null).map((item, idx) => {
                  const quantity = getItemValue(item, 'quantity') as number
                  const price = getItemValue(item, 'price') as number
                  const isTaxable = getItemValue(item, 'taxable') as boolean
                  const hstAmount = isTaxable ? (price * 0.13) : 0
                  const total = price + hstAmount
                  const isExpanded = expandedItem === item.name_raw

                  return (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{item.name_raw}</td>
                      <td className="px-3 py-2">{quantity}</td>
                      <td className="px-3 py-2">${total.toFixed(2)}</td>
                      {people.map((person) => (
                        <td key={person.id} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isItemAssignedToPerson(item.name_raw, person.id)}
                            onChange={() => toggleItemAssignment(item.name_raw, person.id)}
                            className="w-4 h-4 cursor-pointer"
                            style={{ margin: '0 auto', display: 'block' }}
                            title={`Assign to ${person.name}`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => setExpandedItem(isExpanded ? null : item.name_raw)}
                          className="text-lg cursor-pointer hover:opacity-70"
                          title="Advanced options"
                        >
                          ⚙️
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Unequal Split Options */}
          {expandedItem && (
            <div className="border-t p-4 bg-muted/30">
              <h4 className="font-semibold mb-3">Unequal Split for {items.find(i => i.name_raw === expandedItem)?.name_raw}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {people.filter(p => isItemAssignedToPerson(expandedItem, p.id)).map((person) => {
                  const item = items.find(i => i.name_raw === expandedItem)
                  if (!item) return null
                  const price = getItemValue(item, 'price') as number
                  const isTaxable = getItemValue(item, 'taxable') as boolean
                  const hstAmount = isTaxable ? (price * 0.13) : 0
                  const total = price + hstAmount
                  const currentValue = unequalSplits[expandedItem]?.[person.id]

                  return (
                    <div key={person.id} className="flex items-center gap-2">
                      <label className="flex-1 font-medium">{person.name}:</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">(Default: ${total.toFixed(2)})</span>
                        <input
                          type="number"
                          value={currentValue ?? ''}
                          onChange={(e) => setUnequalSplitValue(expandedItem, person.id, parseFloat(e.target.value) || 0)}
                          placeholder={total.toFixed(2)}
                          className="w-24 px-2 py-1 border rounded"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Person View */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Summary by Person</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {people.map((person) => {
              const personItems = items.filter(item => isItemAssignedToPerson(item.name_raw, person.id))
              const total = getPersonItemTotal(person.id)

              return (
                <div key={person.id} className="bg-card border rounded-xl shadow-sm p-4">
                  <h4 className="font-semibold mb-3">{person.name}</h4>
                  {personItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {personItems.map((item) => {
                        const price = getItemValue(item, 'price') as number
                        const isTaxable = getItemValue(item, 'taxable') as boolean
                        const hstAmount = isTaxable ? (price * 0.13) : 0
                        const itemTotal = price + hstAmount
                        const unequalValue = unequalSplits[item.name_raw]?.[person.id]
                        const displayValue = unequalValue !== undefined ? unequalValue : itemTotal

                        return (
                          <div key={item.name_raw} className="flex justify-between text-sm">
                            <span>{item.name_raw}</span>
                            <span className="font-medium">${displayValue.toFixed(2)}</span>
                          </div>
                        )
                      })}
                      <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
                        <span>Total:</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {stage === 'upload' ? renderUpload() : stage === 'review' ? renderReview() : renderSplit()}
    </div>
  )
}

export default App
