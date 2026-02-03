// Upload Modal JavaScript

// File upload handling
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');

// File upload
browseBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Drag and drop
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Handle file selection
function handleFile(file) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload JPG, PNG, or PDF file');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }

    // Update preview info
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const previewImage = document.getElementById('previewImage');
        if (file.type === 'application/pdf') {
            previewImage.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: hsl(var(--muted)); color: hsl(var(--muted-foreground));"><svg style="width: 56px; height: 56px; opacity: 0.5;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2"/><polyline points="14 2 14 8 20 8" stroke-width="2"/></svg></div>';
        } else {
            previewImage.innerHTML = `<img src="${e.target.result}" alt="Receipt preview">`;
        }
    };
    reader.readAsDataURL(file);

    // Move to step 2
    moveToStep(2);
    console.log('📄 File selected:', file.name);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes, k));
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
}

// Step navigation
const cancelBtn = document.getElementById('cancelBtn');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const splitNowBtn = document.getElementById('splitNowBtn');

let currentStep = 1;
let maxStepReached = 1;

// Step indicator clicks
document.querySelectorAll('.step-indicator').forEach(indicator => {
    indicator.addEventListener('click', () => {
        const stepNumber = parseInt(indicator.dataset.step);
        // Only allow going back or to steps already reached
        if (stepNumber <= maxStepReached) {
            moveToStep(stepNumber);
            console.log(`🔄 Navigated to step ${stepNumber}`);
        }
    });
});

cancelBtn.addEventListener('click', () => {
    console.log('❌ Cancelled');
    // Close modal logic here
});

backBtn.addEventListener('click', () => {
    if (currentStep > 1) {
        moveToStep(currentStep - 1);
    }
});

nextBtn.addEventListener('click', () => {
    moveToStep(3);
});

splitNowBtn.addEventListener('click', () => {
    console.log('🔄 Starting split workflow...');
    // Navigate to split page
});
urrentStep = stepNumber;
    maxStepReached = Math.max(maxStepReached, stepNumber);
    
    // Make past steps clickable, future steps not
    document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
        const stepNum = index + 1;
        if (stepNum <= maxStepReached) {
            indicator.style.cursor = 'pointer';
            indicator.style.opacity = stepNum === currentStep ? '1' : '0.6';
        } else {
            indicator.style.cursor = 'not-allowed';
            indicator.style.opacity = '0.4';
        }
    });

    c
// Move to step
function moveToStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.modal-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Hide all step indicators
    document.querySelectorAll('.step-indicator').forEach(indicator => {
        indicator.classList.remove('active');
    });

    // Show current step
    document.querySelector(`[data-step="${stepNumber}"].modal-step`).classList.add('active');
    document.querySelector(`[data-step="${stepNumber}"].step-indicator`).classList.add('active');

    console.log(`📍 Moved to step ${stepNumber}`);
}

// Upload type selection
document.querySelectorAll('input[name="uploadType"]').forEach(option => {
    option.addEventListener('change', (e) => {
        console.log(`📎 Selected type: ${e.target.value}`);
    });
});

console.log('📥 Upload modal ready - Try drag & drop or click browse!');
