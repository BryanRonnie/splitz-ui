// Dashboard JavaScript

// Folder management
const createFolderBtn = document.getElementById('createFolderBtn');
const createFolderModal = document.getElementById('createFolderModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const createBtn = document.getElementById('createBtn');
const folderNameInput = document.getElementById('folderName');
const folderList = document.getElementById('folderList');

// Color picker
let selectedColor = '#6366F1';
const colorOptions = document.querySelectorAll('.color-option');

colorOptions.forEach(option => {
    option.addEventListener('click', () => {
        colorOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        selectedColor = option.dataset.color;
    });
});

// Open modal
createFolderBtn.addEventListener('click', () => {
    createFolderModal.classList.add('active');
    folderNameInput.focus();
});

// Close modal
const closeModal = () => {
    createFolderModal.classList.remove('active');
    folderNameInput.value = '';
};

closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

// Close modal on outside click
createFolderModal.addEventListener('click', (e) => {
    if (e.target === createFolderModal) {
        closeModal();
    }
});

// Create folder
createBtn.addEventListener('click', () => {
    const folderName = folderNameInput.value.trim();
    
    if (!folderName) {
        folderNameInput.focus();
        return;
    }
    
    // Create new folder element
    const folderItem = document.createElement('div');
    folderItem.className = 'folder-item';
    folderItem.dataset.folder = folderName.toLowerCase().replace(/\s+/g, '-');
    
    folderItem.innerHTML = `
        <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: ${selectedColor}">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke-width="2"/>
        </svg>
        <span class="folder-name">${folderName}</span>
        <span class="folder-count">0</span>
    `;
    
    // Add click handler
    folderItem.addEventListener('click', () => {
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('active');
        });
        folderItem.classList.add('active');
        
        // Update header
        document.querySelector('.page-title').textContent = folderName;
        document.querySelector('.receipt-count').textContent = '0 receipts';
    });
    
    folderList.appendChild(folderItem);
    closeModal();
    
    // Show success feedback
    console.log(`✅ Created folder: ${folderName}`);
});

// Folder switching
document.querySelectorAll('.folder-item').forEach(folder => {
    folder.addEventListener('click', () => {
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('active');
        });
        folder.classList.add('active');
        
        // Update header
        const folderName = folder.querySelector('.folder-name').textContent;
        const folderCount = folder.querySelector('.folder-count').textContent;
        document.querySelector('.page-title').textContent = folderName;
        document.querySelector('.receipt-count').textContent = `${folderCount} receipts`;
    });
});

// Receipt card animations
const receiptCards = document.querySelectorAll('.receipt-card');

receiptCards.forEach(card => {
    // Add random slight rotation on page load for natural look
    if (!card.style.getPropertyValue('--rotation')) {
        const randomRotation = (Math.random() - 0.5) * 4; // -2 to 2 degrees
        card.style.setProperty('--rotation', `${randomRotation}deg`);
    }
    
    // Add entrance animation
    card.style.opacity = '0';
    card.style.transform = `translateY(20px) rotate(${card.style.getPropertyValue('--rotation')})`;
    
    setTimeout(() => {
        card.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.opacity = '1';
        card.style.transform = `translateY(0) rotate(${card.style.getPropertyValue('--rotation')})`;
    }, Math.random() * 300);
});

// Search functionality
const searchInput = document.querySelector('.search-input');
const receiptsContainer = document.querySelector('.receipts-container');

searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const receiptStacks = receiptsContainer.querySelectorAll('.receipt-stack:not(.add-new)');
    
    receiptStacks.forEach(stack => {
        const vendor = stack.querySelector('.receipt-vendor')?.textContent.toLowerCase() || '';
        const items = Array.from(stack.querySelectorAll('.receipt-item span:first-child'))
            .map(item => item.textContent.toLowerCase())
            .join(' ');
        
        const matches = vendor.includes(searchTerm) || items.includes(searchTerm);
        
        if (matches || searchTerm === '') {
            stack.style.display = '';
            stack.style.animation = 'fadeIn 0.3s';
        } else {
            stack.style.display = 'none';
        }
    });
});

// Action buttons
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const actionType = btn.querySelector('svg').innerHTML.includes('12 12 r="3"') ? 'view' :
                          btn.querySelector('svg').innerHTML.includes('18.5 2.5') ? 'edit' : 'delete';
        
        const receiptCard = btn.closest('.receipt-card');
        const vendor = receiptCard.querySelector('.receipt-vendor').textContent;
        
        console.log(`Action: ${actionType} on ${vendor}`);
        
        // Add visual feedback
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    });
});

// Add new receipt
document.querySelector('.add-receipt-card').addEventListener('click', () => {
    console.log('📄 Opening receipt upload...');
    // This would open the receipt upload modal/page
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }
    
    // Ctrl/Cmd + N for new receipt
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.querySelector('.add-receipt-card').click();
    }
    
    // Escape to close modal
    if (e.key === 'Escape' && createFolderModal.classList.contains('active')) {
        closeModal();
    }
});

console.log('📊 Dashboard loaded - Keyboard shortcuts: Ctrl+K (search), Ctrl+N (new receipt)');
