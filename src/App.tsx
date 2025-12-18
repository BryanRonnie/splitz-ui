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
      const resp = await fetch('http://127.0.0.1:8000/extract-receipt-multipart-nemotron', {
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
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
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
                  const hst = item.taxable === 'TAXABLE'
                  const hstAmount = item.tax_amount ?? 0
                  const price = item.line_subtotal ?? item.unit_price ?? 0
                  const total = price + hstAmount
                  return (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 align-top">{item.name_normalized || item.name_raw}</td>
                      <td className="px-3 py-2 align-top">{item.quantity}</td>
                      <td className="px-3 py-2 align-top">${price.toFixed(2)}</td>
                      <td className="px-3 py-2 align-top">{hst ? 'TRUE' : 'FALSE'}</td>
                      <td className="px-3 py-2 align-top">{hst ? `$${hstAmount.toFixed(2)}` : ''}</td>
                      <td className="px-3 py-2 align-top">${total.toFixed(3)}</td>
                    </tr>
                  )
                })}
                {/* Summary section separator */}
                <tr className="border-t-2 border-primary/20 bg-muted/30 font-semibold">
                  <td colSpan={6} className="px-3 py-2 text-foreground/70">Summary</td>
                </tr>
                {/* Summary rows */}
                {summaryRows.map((row, idx) => (
                  <tr key={`summary-${idx}`} className={`border-t ${idx === summaryRows.length - 1 ? 'bg-primary/5 font-semibold' : 'bg-muted/20'}`}>
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">{row.hstAmount !== undefined ? (row.hstAmount > 0 ? 'TRUE' : 'FALSE') : ''}</td>
                    <td className="px-3 py-2">{row.hstAmount !== undefined ? `$${row.hstAmount.toFixed(4)}` : ''}</td>
                    <td className="px-3 py-2">{row.amount !== undefined ? `$${row.amount.toFixed(3)}` : ''}</td>
                  </tr>
                ))}
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
