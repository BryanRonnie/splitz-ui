/**
 * MongoDB Integration - Frontend Code
 * 
 * Add these snippets to your React frontend (src/App.tsx)
 */

// ============================================================================
// 1. ADD THESE INTERFACES AT THE TOP
// ============================================================================

interface SavedReceipt {
  id: string;
  filenames: string[];
  upload_timestamp: string;
  status: string;
  vendor?: string;
  grand_total?: number;
  extracted_at?: string;
}

// ============================================================================
// 2. ADD THESE STATE VARIABLES
// ============================================================================

const [receiptsList, setReceiptsList] = useState<SavedReceipt[]>([]);
const [currentMongoId, setCurrentMongoId] = useState<string | null>(null);
const [showSidebar, setShowSidebar] = useState<boolean>(true);

// ============================================================================
// 3. ADD THESE API FUNCTIONS
// ============================================================================

const API_BASE = 'http://localhost:8000';
// const API_BASE = 'https://splitz-backend-200950802-054e750f9667.herokuapp.com/';

async function loadReceiptsList() {
  try {
    const response = await fetch(`${API_BASE}/receipts_db/list`);
    if (!response.ok) throw new Error('Failed to fetch receipts');
    const receipts = await response.json();
    setReceiptsList(receipts);
    console.log('✅ Loaded receipts:', receipts.length);
  } catch (error) {
    console.error('❌ Failed to load receipts:', error);
  }
}

async function createReceiptEntry(filenames: string[]): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/receipts_db/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filenames,
        upload_timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) throw new Error('Failed to create receipt');
    
    const { receipt_id } = await response.json();
    console.log('✅ Created receipt:', receipt_id);
    return receipt_id;
  } catch (error) {
    console.error('❌ Failed to create receipt:', error);
    return null;
  }
}

async function updateReceiptData(mongoId: string, receiptData: any) {
  try {
    const response = await fetch(`${API_BASE}/receipts_db/${mongoId}/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt_data: receiptData })
    });
    
    if (!response.ok) throw new Error('Failed to update receipt');
    
    console.log('✅ Updated receipt:', mongoId);
    await loadReceiptsList(); // Refresh list
  } catch (error) {
    console.error('❌ Failed to update receipt:', error);
  }
}

async function loadReceiptById(mongoId: string) {
  try {
    const response = await fetch(`${API_BASE}/receipts_db/${mongoId}`);
    if (!response.ok) throw new Error('Receipt not found');
    
    const { receipt } = await response.json();
    console.log('✅ Loaded receipt:', mongoId);
    return receipt;
  } catch (error) {
    console.error('❌ Failed to load receipt:', error);
    return null;
  }
}

async function deleteReceiptById(mongoId: string) {
  try {
    const response = await fetch(`${API_BASE}/receipts_db/${mongoId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete receipt');
    
    console.log('✅ Deleted receipt:', mongoId);
    await loadReceiptsList(); // Refresh list
  } catch (error) {
    console.error('❌ Failed to delete receipt:', error);
  }
}

// ============================================================================
// 4. LOAD RECEIPTS ON MOUNT
// ============================================================================

useEffect(() => {
  loadReceiptsList();
}, []);

// ============================================================================
// 5. UPDATE YOUR UPLOAD HANDLER
// ============================================================================

async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;
  
  // Create DB entry FIRST
  const mongoId = await createReceiptEntry(files.map(f => f.name));
  if (mongoId) {
    setCurrentMongoId(mongoId);
  }
  
  // Store files for processing
  setUploadedFiles(files);
  // ... rest of your upload logic
}

// ============================================================================
// 6. UPDATE YOUR PROCESS RECEIPT HANDLER
// ============================================================================

async function handleProcessReceipt() {
  if (!uploadedFiles || uploadedFiles.length === 0) return;
  
  setLoading(true);
  
  try {
    // Call extract-receipt endpoint
    const formData = new FormData();
    uploadedFiles.forEach(file => {
      if (file.name.includes('charges') || file.name.includes('total')) {
        formData.append('charges_image', file);
      } else {
        formData.append('items_images', file);
      }
    });
    
    const response = await fetch(`${API_BASE}/extract_receipt/extract-receipt`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) throw new Error('Extraction failed');
    
    const { receipt } = await response.json();
    
    // Update MongoDB with extraction result
    if (currentMongoId) {
      await updateReceiptData(currentMongoId, receipt);
    }
    
    // Set current receipt for editing
    setCurrentReceipt(receipt);
    
  } catch (error) {
    console.error('Processing failed:', error);
    alert('Failed to process receipt');
  } finally {
    setLoading(false);
  }
}

// ============================================================================
// 7. ADD RECEIPT SELECTION HANDLER
// ============================================================================

async function handleSelectReceipt(mongoId: string) {
  const receiptDoc = await loadReceiptById(mongoId);
  
  if (receiptDoc && receiptDoc.receipt_data) {
    setCurrentReceipt(receiptDoc.receipt_data);
    setCurrentMongoId(mongoId);
    // Navigate to review step if data exists
    setCurrentStep('review');
  } else {
    // Receipt uploaded but not processed yet
    setCurrentMongoId(mongoId);
    setCurrentStep('upload');
  }
}

// ============================================================================
// 8. SIDEBAR COMPONENT
// ============================================================================

function ReceiptsSidebar() {
  return (
    <div style={{
      width: '320px',
      height: '100vh',
      borderRight: '2px solid #e0e0e0',
      backgroundColor: '#f8f9fa',
      padding: '20px',
      overflowY: 'auto',
      boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.5em' }}>Receipts</h2>
        <button 
          onClick={() => setShowSidebar(false)}
          style={{ 
            background: 'none', 
            border: 'none', 
            fontSize: '1.5em',
            cursor: 'pointer' 
          }}
        >
          ✕
        </button>
      </div>
      
      {receiptsList.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center', marginTop: '40px' }}>
          No receipts yet
        </p>
      ) : (
        receiptsList.map(receipt => (
          <div
            key={receipt.id}
            onClick={() => handleSelectReceipt(receipt.id)}
            style={{
              padding: '16px',
              margin: '12px 0',
              border: currentMongoId === receipt.id ? '2px solid #2196F3' : '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: receipt.status === 'EXTRACTED' ? '#e8f5e9' : 
                              receipt.status === 'NEEDS_REVIEW' ? '#fff3e0' : '#ffffff',
              transition: 'all 0.2s',
              boxShadow: currentMongoId === receipt.id ? '0 2px 8px rgba(33,150,243,0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = currentMongoId === receipt.id ? 
                '0 2px 8px rgba(33,150,243,0.3)' : 'none';
            }}
          >
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: '1.1em',
              marginBottom: '8px',
              color: '#333'
            }}>
              {receipt.vendor || 'Unknown Vendor'}
            </div>
            
            <div style={{ 
              fontSize: '0.85em', 
              color: '#666',
              marginBottom: '6px'
            }}>
              📅 {new Date(receipt.upload_timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            
            <div style={{ 
              fontSize: '0.95em',
              fontWeight: 'bold',
              color: '#2e7d32',
              marginBottom: '8px'
            }}>
              💰 ${receipt.grand_total?.toFixed(2) || '—'}
            </div>
            
            <div style={{ 
              fontSize: '0.75em',
              fontWeight: '600',
              textTransform: 'uppercase',
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'inline-block',
              backgroundColor: 
                receipt.status === 'EXTRACTED' ? '#4caf50' :
                receipt.status === 'NEEDS_REVIEW' ? '#ff9800' :
                receipt.status === 'FINALIZED' ? '#2196f3' : '#9e9e9e',
              color: 'white'
            }}>
              {receipt.status}
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this receipt?')) {
                  deleteReceiptById(receipt.id);
                }
              }}
              style={{
                float: 'right',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '0.75em',
                cursor: 'pointer',
                marginTop: '-4px'
              }}
            >
              🗑️ Delete
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// 9. UPDATE MAIN APP LAYOUT
// ============================================================================

// In your return statement, wrap everything in this layout:

return (
  <div style={{ display: 'flex', minHeight: '100vh' }}>
    {showSidebar && <ReceiptsSidebar />}
    
    {!showSidebar && (
      <button
        onClick={() => setShowSidebar(true)}
        style={{
          position: 'fixed',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          background: '#2196F3',
          color: 'white',
          border: 'none',
          padding: '12px 8px',
          cursor: 'pointer',
          borderRadius: '0 8px 8px 0',
          zIndex: 1000
        }}
      >
        ☰
      </button>
    )}
    
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
      {/* YOUR EXISTING APP CONTENT HERE */}
      {/* Upload form, review table, etc. */}
    </div>
  </div>
);
