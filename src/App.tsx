import { useState, useEffect } from 'react'
import FileDropzone from './components/FileDropzone'
import { Button } from './components/Button'
import { Card, CardHeader, CardContent } from './components/Card'
import { Badge } from './components/Badge'
import { Alert } from './components/Alert'
import { Header } from './components/Header'
import { StepIndicator } from './components/StepIndicator'
import { Plus, Trash2, Upload, DollarSign, Users } from 'lucide-react'
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
      taxable?: boolean
      tax_amount?: number
    }>
    fees: Array<{
      type: string
      amount: number
      taxable?: boolean
      tax_amount?: number
    }>
    discounts: Array<{
      description: string
      amount: number
      taxable?: boolean
      tax_amount?: number
    }>
    subtotal_items: number
    total_tax_reported: number | null
    grand_total: number
    status: string
    filename: string
  }
  errors: string[]
}

interface SavedReceipt {
  id: string
  filenames: string[]
  upload_timestamp: string
  status: string
  vendor?: string
  grand_total?: number
  extracted_at?: string
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
  const [receiptsList, setReceiptsList] = useState<SavedReceipt[]>([])
  const [currentMongoId, setCurrentMongoId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState<boolean>(true)
  const [splitResults, setSplitResults] = useState<any>(null)
  const [calculatingSplit, setCalculatingSplit] = useState(false)

  // const API_BASE = 'http://localhost:8000'
  const API_BASE = 'https://splitz-backend-200950802-054e750f9667.herokuapp.com';

  const loadReceiptsList = async () => {
    try {
      const response = await fetch(`${API_BASE}/receipts_db/list`)
      if (!response.ok) throw new Error('Failed to fetch receipts')
      const receipts = await response.json()
      setReceiptsList(receipts)
      console.log('✅ Loaded receipts:', receipts.length)
    } catch (error) {
      console.error('❌ Failed to load receipts:', error)
    }
  }

  const createReceiptEntry = async (filenames: string[]): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE}/receipts_db/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenames,
          upload_timestamp: new Date().toISOString()
        })
      })
      
      if (!response.ok) throw new Error('Failed to create receipt')
      
      const { receipt_id } = await response.json()
      console.log('✅ Created receipt:', receipt_id)
      return receipt_id
    } catch (error) {
      console.error('❌ Failed to create receipt:', error)
      return null
    }
  }

  const updateReceiptData = async (mongoId: string, receiptData: any) => {
    try {
      const response = await fetch(`${API_BASE}/receipts_db/${mongoId}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_data: receiptData })
      })
      
      if (!response.ok) throw new Error('Failed to update receipt')
      
      console.log('✅ Updated receipt:', mongoId)
      await loadReceiptsList()
    } catch (error) {
      console.error('❌ Failed to update receipt:', error)
    }
  }

  const loadReceiptById = async (mongoId: string) => {
    try {
      const response = await fetch(`${API_BASE}/receipts_db/${mongoId}`)
      if (!response.ok) throw new Error('Receipt not found')
      
      const { receipt } = await response.json()
      console.log('✅ Loaded receipt:', mongoId)
      return receipt
    } catch (error) {
      console.error('❌ Failed to load receipt:', error)
      return null
    }
  }

  const deleteReceiptById = async (mongoId: string) => {
    try {
      const response = await fetch(`${API_BASE}/receipts_db/${mongoId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete receipt')
      
      console.log('✅ Deleted receipt:', mongoId)
      await loadReceiptsList()
      if (currentMongoId === mongoId) {
        setCurrentMongoId(null)
        setReceipt(null)
        setStage('upload')
      }
    } catch (error) {
      console.error('❌ Failed to delete receipt:', error)
    }
  }

  const handleSelectReceipt = async (mongoId: string) => {
    const receiptDoc = await loadReceiptById(mongoId)
    
    if (receiptDoc && receiptDoc.receipt_data) {
      const receiptData = receiptDoc.receipt_data
      setReceipt(receiptData)
      setCurrentMongoId(mongoId)
      
      // Check if receipt has finalized split results
      if (receiptData.split_results) {
        console.log('✅ Loading finalized split results')
        
        // Restore split results
        setSplitResults({
          success: true,
          receipt_id: receiptData.receipt_id,
          split_id: receiptData.split_results.split_id,
          shares: receiptData.split_results.shares,
          total_validation: receiptData.split_results.total_validation,
          errors: []
        })
        
        // Restore people and assignments from the split request
        if (receiptData.split_results.split_request) {
          const splitRequest = receiptData.split_results.split_request
          
          // Restore people
          if (splitRequest.people && splitRequest.people.length > 0) {
            const restoredPeople = splitRequest.people.map((name: string, idx: number) => ({
              id: `person-${idx + 1}`,
              name: name
            }))
            setPeople(restoredPeople)
            
            // Create a mapping from person name to person ID
            const nameToIdMap: Record<string, string> = {}
            restoredPeople.forEach((p: Person) => {
              nameToIdMap[p.name] = p.id
            })
            
            // Restore item assignments using the name-to-ID mapping
            if (splitRequest.item_split_rules) {
              const newAssignments: Record<string, Set<string>> = {}
              
              splitRequest.item_split_rules.forEach((rule: any) => {
                if (rule.split_type === 'EQUAL' && rule.metadata?.people) {
                  // Convert person names to person IDs
                  const personIds = rule.metadata.people
                    .map((name: string) => nameToIdMap[name])
                    .filter((id: string | undefined) => id !== undefined)
                  newAssignments[rule.item_id] = new Set(personIds)
                } else if (rule.split_type === 'FIXED_AMOUNT' && rule.metadata) {
                  // Convert person names to person IDs
                  const personIds = Object.keys(rule.metadata)
                    .map((name: string) => nameToIdMap[name])
                    .filter((id: string | undefined) => id !== undefined)
                  newAssignments[rule.item_id] = new Set(personIds)
                }
              })
              
              setItemAssignments(newAssignments)
            }
          }
        }
        
        // Go directly to split stage
        setStage('split')
      } else {
        setStage('review')
      }
    } else {
      setCurrentMongoId(mongoId)
      setStage('upload')
    }
  }

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
    if (field === 'taxable') {
      const isTaxable = edited?.taxable ?? false
      if (isTaxable !== false) {
        console.debug(`getItemValue("${item.name_raw}", "taxable") => ${isTaxable}`)
      }
      return isTaxable
    }
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

  const handleCalculateSplit = async () => {
    if (!receipt) return
    if (people.length === 0) {
      setError('Please add at least one person to split with')
      return
    }

    setCalculatingSplit(true)
    setError(null)
    setSplitResults(null)

    try {
      // Step 1: Make sure we have the latest receipt data from MongoDB
      let latestReceipt = receipt
      if (currentMongoId) {
        console.log('📖 Loading latest receipt from MongoDB...')
        const mongoReceipt = await loadReceiptById(currentMongoId)
        if (mongoReceipt && mongoReceipt.receipt_data) {
          latestReceipt = mongoReceipt.receipt_data
          console.log('✅ Loaded latest from MongoDB')
        }
      }

      // Step 2: Ensure receipt is stored in backend's in-memory store
      console.log('📦 Ensuring receipt is in backend store...')
      const storeResp = await fetch(`${API_BASE}/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latestReceipt)
      })
      
      if (!storeResp.ok) {
        console.warn('⚠️ Failed to store receipt in backend, attempting split anyway')
      } else {
        console.log('✅ Receipt ensured in backend store')
      }

      // Step 3: Build item_split_rules from current assignments
      const itemSplitRules: any[] = []
      
      receipt.line_items.forEach(item => {
        const assignedPeople = people.filter(p => isItemAssignedToPerson(item.name_raw, p.id))
        
        if (assignedPeople.length === 0) {
          // Skip unassigned items
          return
        }

        // Check if there are unequal splits for this item
        const hasUnequalSplit = assignedPeople.some(p => unequalSplits[item.name_raw]?.[p.id] !== undefined)
        
        if (hasUnequalSplit) {
          // Use FIXED_AMOUNT split type
          const metadata: Record<string, number> = {}
          assignedPeople.forEach(p => {
            const customAmount = unequalSplits[item.name_raw]?.[p.id]
            if (customAmount !== undefined) {
              metadata[p.name] = customAmount
            } else {
              // Default to equal split of this person's portion
              const price = getItemValue(item, 'price') as number
              const isTaxable = getItemValue(item, 'taxable') as boolean
              const hstAmount = isTaxable ? (price * 0.13) : 0
              metadata[p.name] = price + hstAmount
            }
          })
          
          itemSplitRules.push({
            item_id: item.name_raw, // Using name_raw as ID
            split_type: 'FIXED_AMOUNT',
            metadata
          })
        } else {
          // Use EQUAL split type
          itemSplitRules.push({
            item_id: item.name_raw,
            split_type: 'EQUAL',
            metadata: {
              people: assignedPeople.map(p => p.name)
            }
          })
        }
      })

      console.log('📤 Sending split request:', {
        receipt_id: latestReceipt.receipt_id,
        people: people.map(p => p.name),
        item_split_rules: itemSplitRules
      })

      const response = await fetch(`${API_BASE}/receipts/${latestReceipt.receipt_id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          people: people.map(p => p.name),
          strategy: 'UNEVEN', // Will be ignored since we're using item_split_rules
          item_split_rules: itemSplitRules
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || errorData.errors?.[0] || 'Split calculation failed')
      }

      const data = await response.json()
      console.log('✅ Split calculation result:', data)
      
      setSplitResults(data)
    } catch (err) {
      console.error('❌ Split calculation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to calculate split')
    } finally {
      setCalculatingSplit(false)
    }
  }

  const handleFinalizeSplit = async () => {
    if (!receipt || !splitResults) return
    if (people.length === 0) {
      setError('No split to finalize')
      return
    }

    setCalculatingSplit(true)
    setError(null)

    try {
      // Build item_split_rules from current assignments (same as in handleCalculateSplit)
      const itemSplitRules: any[] = []
      
      receipt.line_items.forEach(item => {
        const assignedPeople = people.filter(p => isItemAssignedToPerson(item.name_raw, p.id))
        
        if (assignedPeople.length === 0) {
          return
        }

        const hasUnequalSplit = assignedPeople.some(p => unequalSplits[item.name_raw]?.[p.id] !== undefined)
        
        if (hasUnequalSplit) {
          const metadata: Record<string, number> = {}
          assignedPeople.forEach(p => {
            const customAmount = unequalSplits[item.name_raw]?.[p.id]
            if (customAmount !== undefined) {
              metadata[p.name] = customAmount
            } else {
              const price = getItemValue(item, 'price') as number
              const isTaxable = getItemValue(item, 'taxable') as boolean
              const hstAmount = isTaxable ? (price * 0.13) : 0
              metadata[p.name] = price + hstAmount
            }
          })
          
          itemSplitRules.push({
            item_id: item.name_raw,
            split_type: 'FIXED_AMOUNT',
            metadata
          })
        } else {
          itemSplitRules.push({
            item_id: item.name_raw,
            split_type: 'EQUAL',
            metadata: {
              people: assignedPeople.map(p => p.name)
            }
          })
        }
      })

      console.log('💾 Finalizing split...')

      const response = await fetch(`${API_BASE}/receipts/${receipt.receipt_id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          people: people.map(p => p.name),
          strategy: 'UNEVEN',
          item_split_rules: itemSplitRules
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || errorData.errors?.[0] || 'Finalize failed')
      }

      const data = await response.json()
      console.log('✅ Split finalized:', data)
      
      // Update local receipt to show it's finalized
      const updatedReceipt = {
        ...receipt,
        status: 'FINALIZED',
        split_results: {
          split_id: data.split_id,
          shares: data.shares,
          total_validation: data.total_validation,
          finalized_at: new Date().toISOString(),
          split_request: {
            people: people.map(p => p.name),
            strategy: 'UNEVEN',
            item_split_rules: itemSplitRules
          }
        }
      }
      
      setReceipt(updatedReceipt)
      
      // Save to MongoDB if we have a mongo ID
      if (currentMongoId) {
        await updateReceiptData(currentMongoId, updatedReceipt)
        console.log('✅ Saved finalized split to MongoDB')
      }
      
      alert('Split finalized successfully! This split will be loaded automatically when you view this receipt.')
    } catch (err) {
      console.error('❌ Finalize error:', err)
      setError(err instanceof Error ? err.message : 'Failed to finalize split')
    } finally {
      setCalculatingSplit(false)
    }
  }

  useEffect(() => {

    loadReceiptsList()
  }, [])

  const handleItemsFiles = async (files: File[]) => {
    setItemsFiles(prev => [...prev, ...files])
    
    // Create DB entry when first files are uploaded
    if (itemsFiles.length === 0 && chargesFiles.length === 0 && !currentMongoId) {
      const allFilenames = files.map(f => f.name)
      const mongoId = await createReceiptEntry(allFilenames)
      if (mongoId) {
        setCurrentMongoId(mongoId)
      }
    }
  }

  const handleChargesFiles = async (files: File[]) => {
    setChargesFiles(files.slice(0, 1)) // Only keep first file
    
    // Create DB entry when first files are uploaded
    if (itemsFiles.length === 0 && chargesFiles.length === 0 && !currentMongoId) {
      const allFilenames = files.map(f => f.name)
      const mongoId = await createReceiptEntry(allFilenames)
      if (mongoId) {
        setCurrentMongoId(mongoId)
      }
    }
  }

  const removeItemsFile = (index: number) => {
    setItemsFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeChargesFile = (index: number) => {
    setChargesFiles(prev => prev.filter((_, i) => i !== index))
  }

  const canProcess = itemsFiles.length > 0 && chargesFiles.length > 0

  const handleClassifyTaxability = async () => {
    if (!receipt || !receipt.line_items || receipt.line_items.length === 0) {
      setError('No items to classify')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const itemsToClassify = receipt.line_items.map(item => ({
        name_raw: item.name_raw
      }))

      console.log('📤 Sending to classify-taxability:', itemsToClassify)

      const response = await fetch(`${API_BASE}/extract_receipt/classify-taxability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToClassify })
      })

      if (!response.ok) {
        throw new Error('Failed to classify taxability')
      }

      const data = await response.json()
      
      console.log('📥 API Response:', data)
      
      if (!data.success || !data.items) {
        throw new Error('Invalid classification response')
      }

      console.log('✅ Classified items:', data.items)

      // Update editedItems state with taxability results
      const newEditedItems = { ...editedItems }
      console.log('📝 Current editedItems before update:', editedItems)
      
      data.items.forEach((classifiedItem: { name_raw: string; taxable: boolean }) => {
        console.log(`  → Setting ${classifiedItem.name_raw} to taxable: ${classifiedItem.taxable}`)
        if (!newEditedItems[classifiedItem.name_raw]) {
          const originalItem = receipt.line_items.find(item => item.name_raw === classifiedItem.name_raw)
          newEditedItems[classifiedItem.name_raw] = {
            quantity: originalItem?.quantity ?? 0,
            price: originalItem?.line_subtotal ?? 0,
            taxable: classifiedItem.taxable
          }
          console.log(`     (Created new entry)`)
        } else {
          newEditedItems[classifiedItem.name_raw].taxable = classifiedItem.taxable
          console.log(`     (Updated existing entry)`)
        }
      })
      
      console.log('📝 newEditedItems after update:', newEditedItems)
      setEditedItems(newEditedItems)
      console.log('✅ State updated with setEditedItems')
      console.log('✅ Taxability classification complete (UI only - will save to DB when clicking Split)')
    } catch (err) {
      console.error('❌ Classification error:', err)
      setError(err instanceof Error ? err.message : 'Classification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoToSplit = async () => {
    if (!receipt) return

    setLoading(true)
    try {
      const discount = receipt.discounts?.[0] ?? null
      const updatedDiscountAmount = getDiscountValue('price', discount?.amount ?? 0) as number
      const updatedDiscountTaxable = getDiscountValue('taxable', discount?.amount ?? 0) as boolean
      const updatedDiscountTax = updatedDiscountTaxable ? updatedDiscountAmount * 0.13 : 0
      const updatedDiscounts = discount
        ? [{
            ...discount,
            amount: updatedDiscountAmount,
            taxable: updatedDiscountTaxable,
            tax_amount: updatedDiscountTax
          }]
        : (updatedDiscountAmount !== 0 || updatedDiscountTaxable)
          ? [{
              description: 'Discount',
              amount: updatedDiscountAmount,
              taxable: updatedDiscountTaxable,
              tax_amount: updatedDiscountTax
            }]
          : []

      // Build updated receipt with all current edits (qty, price, taxability, discounts)
      const updatedReceipt = {
        ...receipt,
        line_items: receipt.line_items.map(item => {
          const price = getItemValue(item, 'price') as number
          const taxable = getItemValue(item, 'taxable') as boolean
          const taxAmount = taxable ? price * 0.13 : 0
          return {
            ...item,
            quantity: getItemValue(item, 'quantity') as number,
            line_subtotal: price,
            taxable: taxable,
            tax_amount: taxAmount
          }
        }),
        discounts: updatedDiscounts
      }

      console.log('💾 Saving to MongoDB with all edits (qty, price, taxability, discounts)...')
      console.log('🧾 Discount payload:', updatedDiscounts)
      console.log('📦 Receipt to save:', updatedReceipt)

      // Update MongoDB with latest edits (including taxability)
      if (currentMongoId) {
        await updateReceiptData(currentMongoId, updatedReceipt)
        console.log('✅ MongoDB updated with all edits')
      }

      setReceipt(updatedReceipt)
      setStage('split')
      console.log('✅ Receipt saved and navigated to split screen')
    } catch (err) {
      console.error('❌ Error saving receipt:', err)
      setError(err instanceof Error ? err.message : 'Failed to save receipt')
    } finally {
      setLoading(false)
    }
  }

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
      const resp = await fetch(`${API_BASE}/extract_receipt/extract-receipt`, {
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

      // Store receipt in backend's in-memory store
      try {
        console.log('💾 Storing receipt in backend...')
        const storeResp = await fetch(`${API_BASE}/receipts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.receipt)
        })
        
        if (storeResp.ok) {
          const storeData = await storeResp.json()
          console.log('✅ Receipt stored in backend:', storeData)
        } else {
          console.warn('⚠️ Failed to store receipt in backend')
        }
      } catch (storeErr) {
        console.warn('⚠️ Receipt storage error:', storeErr)
      }

      // Apply backend tax reconciliation
      try {
        console.log('🧮 Applying tax reconciliation...')
        const taxResp = await fetch(`${API_BASE}/pipeline/reconcile-tax?receipt_id=${data.receipt.receipt_id}`, {
          method: 'POST'
        })
        
        if (taxResp.ok) {
          const taxData = await taxResp.json()
          console.log('✅ Tax reconciliation complete:', taxData)
          // The backend has updated the receipt in its store, but we need to use the response
        } else {
          console.warn('⚠️ Tax reconciliation failed, using original extraction')
        }
      } catch (taxErr) {
        console.warn('⚠️ Tax reconciliation error:', taxErr)
      }

      setReceipt(data.receipt)
      
      // Update MongoDB with extraction result
      if (currentMongoId) {
        await updateReceiptData(currentMongoId, data.receipt)
      }
      
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  const renderSidebar = () => (
    <div className="w-80 h-screen border-r-2 bg-muted/20 p-5 overflow-y-auto shadow-lg">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold">Receipts</h2>
        <button
          onClick={() => setShowSidebar(false)}
          className="text-2xl hover:opacity-70 transition-opacity"
        >
          ✕
        </button>
      </div>
      
      {receiptsList.length === 0 ? (
        <p className="text-muted-foreground text-center mt-10">
          No receipts yet
        </p>
      ) : (
        receiptsList.map(receipt => (
          <div
            key={receipt.id}
            onClick={() => handleSelectReceipt(receipt.id)}
            className={`p-4 my-3 rounded-lg cursor-pointer transition-all ${
              currentMongoId === receipt.id 
                ? 'border-2 border-primary shadow-md' 
                : 'border border-border'
            } ${
              receipt.status === 'EXTRACTED' ? 'bg-green-50' :
              receipt.status === 'NEEDS_REVIEW' ? 'bg-orange-50' : 'bg-card'
            } hover:-translate-y-0.5 hover:shadow-lg`}
          >
            <div className="font-bold text-lg mb-2">
              {receipt.vendor || 'Unknown Vendor'}
            </div>
            
            <div className="text-sm text-muted-foreground mb-2">
              📅 {new Date(receipt.upload_timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            
            <div className="text-base font-bold text-green-700 mb-2">
              💰 ${receipt.grand_total?.toFixed(2) || '—'}
            </div>
            
            <div className="flex justify-between items-center">
              <span className={`text-xs font-semibold uppercase px-2 py-1 rounded ${
                receipt.status === 'EXTRACTED' ? 'bg-green-500 text-white' :
                receipt.status === 'NEEDS_REVIEW' ? 'bg-orange-500 text-white' :
                receipt.status === 'FINALIZED' ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'
              }`}>
                {receipt.status}
              </span>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Delete this receipt?')) {
                    deleteReceiptById(receipt.id)
                  }
                }}
                className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs hover:bg-destructive/90 transition-colors"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )

  const renderUpload = () => (
    <>
      <Header 
        title="Splitz" 
        subtitle="Upload your receipt and we'll help you split it fairly"
        icon={<DollarSign className="w-8 h-8" />}
      />
      
      <div className="min-h-[calc(100vh-200px)] bg-gradient-to-b from-blue-50 to-white py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <StepIndicator currentStep="upload" />
          {error && (
            <Alert variant="error" title="Upload Error" className="mb-8">
              {error}
            </Alert>
          )}

          <div className="space-y-8">
            {/* Items Upload Card */}
            <Card className="hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Upload className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Items & Prices</h3>
                    <p className="text-sm text-gray-600">Upload one or more images showing items and their prices</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <FileDropzone
                  title="Select Receipt Item Images"
                  description="PNG, JPG, JPEG, or WebP (you can upload multiple)"
                  files={itemsFiles}
                  onFilesAccepted={handleItemsFiles}
                  onRemoveFile={removeItemsFile}
                  multiple={true}
                />
              </CardContent>
            </Card>

            {/* Charges Upload Card */}
            <Card className="hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                    <DollarSign className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Charges & Taxes</h3>
                    <p className="text-sm text-gray-600">Upload the receipt section showing total charges, taxes, and fees</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <FileDropzone
                  title="Select Receipt Charges Image"
                  description="PNG, JPG, JPEG, or WebP (single file)"
                  files={chargesFiles}
                  onFilesAccepted={handleChargesFiles}
                  onRemoveFile={removeChargesFile}
                  multiple={false}
                />
              </CardContent>
            </Card>

            {/* File Status Cards */}
            {itemsFiles.length > 0 || chargesFiles.length > 0 ? (
              <Card variant="highlighted">
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Items Images:</span>
                      <Badge variant="success">{itemsFiles.length} file(s)</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Charges Image:</span>
                      <Badge variant={chargesFiles.length > 0 ? "success" : "warning"}>
                        {chargesFiles.length > 0 ? '1 file' : 'Missing'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Process Button */}
            {canProcess ? (
              <div className="flex gap-4 justify-center pt-6">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => handleProcess()}
                  isLoading={loading}
                >
                  {loading ? 'Processing Receipt...' : 'Process Receipt'}
                </Button>
              </div>
            ) : (
              <Card variant="subtle">
                <CardContent>
                  <p className="text-center text-gray-600">
                    <span className="font-semibold">📋 Ready to continue?</span><br/>
                    Upload both receipt images to proceed
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
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
              onClick={handleClassifyTaxability}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-green-500 bg-green-50 px-3 py-2 text-xs font-medium hover:bg-green-100 transition-colors text-green-700 disabled:opacity-60"
              title="Auto-classify items as taxable or non-taxable"
            >
              {loading ? 'Classifying…' : '🤖 Guess Taxability'}
            </button>
            <button
              onClick={handleGoToSplit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Split →'}
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
        <Card className="hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold">Participants</h3>
              <Badge variant="info">{people.length} person{people.length !== 1 ? 's' : ''}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {people.map((person) => (
                <div key={person.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => updatePersonName(person.id, e.target.value)}
                    className="flex-1 bg-white px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Person name"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removePerson(person.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border-2 border-dashed border-blue-200">
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPerson()}
                  className="flex-1 bg-white px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add new person..."
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={addPerson}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Split Table */}
        <Card className="overflow-hidden">
          <CardHeader>
            <h3 className="text-lg font-semibold">Assign Items to Participants</h3>
          </CardHeader>
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
        </Card>

        {/* Calculate Split Button */}
        <div className="flex justify-center py-8">
          <Button
            variant="primary"
            size="lg"
            onClick={handleCalculateSplit}
            isLoading={calculatingSplit}
            disabled={people.length === 0}
            className="gap-3"
          >
            🧮 {calculatingSplit ? 'Calculating split...' : 'Calculate Split'}
          </Button>
        </div>

        {/* Split Results */}
        {splitResults && splitResults.success && (
          <div className="space-y-8">
            {/* Header Card */}
            <Card variant="highlighted" className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white text-2xl">
                      ✓
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-green-900">Split Calculated</h3>
                      <p className="text-sm text-green-700">Ready to finalize and save</p>
                    </div>
                  </div>
                  <Badge variant="success" className="text-base px-4 py-2">
                    ID: {splitResults.split_id.substring(0, 8)}...
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Share Cards Grid */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-gray-900">Share Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {splitResults.shares.map((share: any) => (
                  <Card key={share.person_id} className="relative overflow-hidden hover:shadow-lg border-2 border-green-100">
                    {/* Person Header */}
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
                          {share.person_name.charAt(0).toUpperCase()}
                        </div>
                        <h5 className="text-lg font-bold text-gray-900">{share.person_name}</h5>
                      </div>
                    </div>

                    <CardContent className="pt-6">
                      {/* Items breakdown */}
                      {share.items && share.items.length > 0 && (
                        <div className="mb-6">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Items Assigned</p>
                          <div className="space-y-2">
                            {share.items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700 truncate">{item.item_name || item.item_id}</span>
                                <span className="font-semibold text-gray-900 whitespace-nowrap ml-2">
                                  ${item.item_cost?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Breakdown Summary */}
                      <div className="space-y-3 border-t border-gray-200 pt-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-700">Subtotal</span>
                          <span className="font-semibold text-gray-900">${(share.item_total || 0).toFixed(2)}</span>
                        </div>

                        {/* Fee breakdown */}
                        {share.fees_breakdown && share.fees_breakdown.map((fee: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-700">{fee.description}</span>
                            <span className="font-semibold text-gray-900">${fee.total?.toFixed(2) || '0.00'}</span>
                          </div>
                        ))}

                        {/* Item tax */}
                        {share.item_tax !== undefined && share.item_tax > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-700">Tax (13%)</span>
                            <span className="font-semibold text-gray-900">${share.item_tax.toFixed(2)}</span>
                          </div>
                        )}

                        {/* Discount */}
                        {(share.discount_credit || share.allocated_discounts) !== undefined && (share.discount_credit || share.allocated_discounts) !== 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-red-700 font-medium">Discount</span>
                            <span className="font-semibold text-red-700">
                              -${Math.abs(share.discount_credit || share.allocated_discounts || 0).toFixed(2)}
                            </span>
                          </div>
                        )}

                        {/* Total Amount Owed */}
                        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                          <span className="font-bold text-gray-900">Total</span>
                          <span className="text-2xl font-bold text-green-600">
                            ${share.amount_owed?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Validation Card */}
            {splitResults.total_validation && (
              <Card className={`border-2 ${splitResults.total_validation.is_valid ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {splitResults.total_validation.is_valid ? (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white">
                          ✓
                        </div>
                        <h4 className="text-lg font-bold text-green-900">Validation Passed</h4>
                      </>
                    ) : (
                      <>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white">
                          ⚠
                        </div>
                        <h4 className="text-lg font-bold text-red-900">Validation Issues</h4>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-center sm:text-left">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">Receipt Total</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${splitResults.total_validation.receipt_total?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">Sum of Shares</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${splitResults.total_validation.split_total?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">Difference</p>
                    <p className={`text-xl font-bold ${splitResults.total_validation.difference === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {splitResults.total_validation.difference === 0 ? '✓ $0.00' : `$${Math.abs(splitResults.total_validation.difference || 0).toFixed(2)}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Errors Alert */}
            {splitResults.errors && splitResults.errors.length > 0 && (
              <Alert variant="error" title="Calculation Errors">
                <ul className="space-y-1">
                  {splitResults.errors.map((err: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span>•</span> {err}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button
                variant="secondary"
                onClick={() => setStage('review')}
              >
                ← Back to Review
              </Button>
              <Button
                variant="success"
                size="lg"
                onClick={handleFinalizeSplit}
                isLoading={calculatingSplit}
                disabled={!splitResults.total_validation?.is_valid}
              >
                {calculatingSplit ? 'Saving Split...' : '💾 Finalize & Save'}
              </Button>
            </div>
          </div>
        )}

        {/* Person View (Preview - Before Calculation) */}
        {!splitResults && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Preview (Client-Side Estimate)</h3>
            <p className="text-sm text-muted-foreground">Click "Calculate Split" above for accurate backend calculation</p>
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
                          <span>Estimated Total:</span>
                          <span>${total.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {showSidebar && renderSidebar()}
      
      {!showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-2 py-3 rounded-r-lg z-50 hover:bg-primary/90 transition-colors"
        >
          ☰
        </button>
      )}
      
      <div className="flex-1 bg-gradient-to-br from-background to-muted/20 overflow-y-auto">
        {stage === 'upload' ? renderUpload() : stage === 'review' ? renderReview() : renderSplit()}
      </div>
    </div>
  )
}

export default App
