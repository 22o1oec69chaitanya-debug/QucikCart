let quaggaLoaded = false;
const checkQuagga = setInterval(() => {
  if (typeof Quagga !== 'undefined') {
    quaggaLoaded = true;
    clearInterval(checkQuagga);
  }
}, 100);

const RAZORPAY_KEY = 'rzp_test_1DP5mmOlF5G5ag';
const DB_KEY = 'quickcart_products';
const CART_KEY = 'quickcart_cart';
const TRANSACTIONS_KEY = 'quickcart_transactions';
const EXIT_LOG_KEY = 'quickcart_exit_log';
const STATS_KEY = 'quickcart_security_stats';
const SECURITY_PASSWORD = '1234';
const ADMIN_PASSWORD = 'admin123';

let cart = [];
let isCameraActive = false;
let lastScannedCode = null;
let scanCooldown = false;
let html5QrCode = null;
let currentTransaction = null;
let currentView = 'main';
let currentAdminTab = 'overview';

document.addEventListener('DOMContentLoaded', () => {
  initializeProducts();
  loadCartFromStorage();
  renderCart();
});

function switchToSecurity() {
  const password = prompt('🔐 Enter Security Password:');
  
  if (password === null) return;
  
  if (password !== SECURITY_PASSWORD) {
    alert('❌ Incorrect Password! Access Denied.');
    return;
  }
  
  document.getElementById('mainApp').classList.remove('active');
  document.getElementById('securityApp').classList.add('active');
  currentView = 'security';
  loadStats();
  loadExitLog();
  showToast('🛡️ Security Portal Access Granted', 'success');
}

function switchToAdmin() {
  const password = prompt('🔐 Enter Admin Password:');
  
  if (password === null) return;
  
  if (password !== ADMIN_PASSWORD) {
    alert('❌ Incorrect Password! Access Denied.');
    return;
  }
  
  document.getElementById('mainApp').classList.remove('active');
  document.getElementById('adminApp').classList.add('active');
  currentView = 'admin';
  loadAdminDashboard();
  showToast('👨‍💼 Admin Dashboard Access Granted', 'success');
}

function switchToMain() {
  document.getElementById('securityApp').classList.remove('active');
  document.getElementById('adminApp').classList.remove('active');
  document.getElementById('mainApp').classList.add('active');
  currentView = 'main';
  renderCart();
}

function initializeProducts() {
  if (!localStorage.getItem(DB_KEY)) {
    const products = [
      { id: '1', barcode: '8901234567890', name: 'Maggi 2-Minute Noodles', variant: '2-Pack (140g)', price: 10, gstRate: 12, category: 'Food', stock: 100 },
      { id: '2', barcode: '8901234567891', name: 'Coca Cola', variant: '600ml Bottle', price: 40, gstRate: 18, category: 'Beverages', stock: 80 },
      { id: '3', barcode: '8901234567892', name: 'Britannia Bread', variant: '400g White', price: 30, gstRate: 5, category: 'Bakery', stock: 50 },
      { id: '4', barcode: '8901234567893', name: 'Tata Salt', variant: '1kg Pack', price: 20, gstRate: 5, category: 'Grocery', stock: 120 },
      { id: '5', barcode: '8901234567894', name: 'Amul Butter', variant: '100g Pack', price: 50, gstRate: 12, category: 'Dairy', stock: 60 },
      { id: '6', barcode: '8901234567895', name: 'Parle-G Biscuits', variant: '200g Pack', price: 20, gstRate: 12, category: 'Snacks', stock: 150 },
      { id: '7', barcode: '8901234567896', name: 'Lays Chips', variant: '50g Classic Salted', price: 20, gstRate: 12, category: 'Snacks', stock: 90 },
      { id: '8', barcode: '8901234567897', name: 'Colgate Toothpaste', variant: '200g Strong Teeth', price: 80, gstRate: 18, category: 'Personal Care', stock: 70 }
    ];
    localStorage.setItem(DB_KEY, JSON.stringify(products));
  }
}

function getProductByBarcode(barcode) {
  const products = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  return products.find(p => p.barcode === barcode);
}

function getAllProducts() {
  return JSON.parse(localStorage.getItem(DB_KEY) || '[]');
}

function saveProducts(products) {
  localStorage.setItem(DB_KEY, JSON.stringify(products));
}

function scanBarcode() {
  const input = document.getElementById('barcodeInput');
  const barcode = input.value.trim();
  
  if (!barcode) {
    showToast('Please enter a barcode', 'error');
    return;
  }
  
  addToCart(barcode);
  input.value = '';
}

function quickScan(barcode) {
  addToCart(barcode);
}

function addToCart(barcode) {
  const product = getProductByBarcode(barcode);
  
  if (!product) {
    showToast('Product not found for this barcode', 'error');
    return;
  }
  
  const existingItem = cart.find(item => item.id === product.id);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      barcode: product.barcode,
      name: product.name,
      variant: product.variant,
      price: product.price,
      gstRate: product.gstRate,
      quantity: 1
    });
  }
  
  saveCartToStorage();
  renderCart();
  showToast(`${product.name} added to cart`, 'success');
}

function openCameraScanner() {
  if (currentView === 'main') {
    if (!quaggaLoaded) {
      showToast('Camera library is loading, please wait...', 'error');
      return;
    }
    
    document.getElementById('cameraModal').classList.add('active');
    isCameraActive = true;
    lastScannedCode = null;
    scanCooldown = false;
    
    setTimeout(() => {
      initializeCamera();
    }, 300);
  } else {
    openQRScanner();
  }
}

function closeCameraScanner() {
  if (isCameraActive && typeof Quagga !== 'undefined') {
    Quagga.stop();
    isCameraActive = false;
  }
  document.getElementById('cameraModal').classList.remove('active');
}

function initializeCamera() {
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#interactive'),
      constraints: {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        facingMode: "environment",
        aspectRatio: { min: 1, max: 2 }
      },
    },
    locator: {
      patchSize: "medium",
      halfSample: true
    },
    numOfWorkers: 4,
    frequency: 10,
    decoder: {
      readers: [
        "ean_reader",
        "ean_8_reader",
        "code_128_reader",
        "code_39_reader",
        "upc_reader",
        "upc_e_reader"
      ],
      debug: {
        drawBoundingBox: false,
        showFrequency: false,
        drawScanline: false,
        showPattern: false
      }
    },
    locate: true
  }, function(err) {
    if (err) {
      showToast('Camera access denied or not available', 'error');
      closeCameraScanner();
      return;
    }
    Quagga.start();
  });

  Quagga.onDetected(function(result) {
    if (scanCooldown) return;
    
    const code = result.codeResult.code;
    
    if (code === lastScannedCode) return;
    
    if (!/^\d{8,13}$/.test(code)) {
      return;
    }
    
    lastScannedCode = code;
    scanCooldown = true;
    
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
    
    const frame = document.querySelector('.scan-frame');
    if (frame) {
      frame.style.borderColor = '#10b981';
      setTimeout(() => {
        frame.style.borderColor = 'var(--primary)';
      }, 500);
    }
    
    setTimeout(() => {
      closeCameraScanner();
      addToCart(code);
    }, 300);
    
    setTimeout(() => {
      scanCooldown = false;
      lastScannedCode = null;
    }, 2000);
  });
}

function updateQuantity(productId, delta) {
  const item = cart.find(i => i.id === productId);
  
  if (!item) return;
  
  item.quantity += delta;
  
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id !== productId);
  }
  
  saveCartToStorage();
  renderCart();
}

function renderCart() {
  const emptyCart = document.getElementById('emptyCart');
  const cartList = document.getElementById('cartList');
  const cartSummary = document.getElementById('cartSummary');
  
  if (cart.length === 0) {
    emptyCart.style.display = 'block';
    cartList.style.display = 'none';
    cartSummary.style.display = 'none';
    return;
  }
  
  emptyCart.style.display = 'none';
  cartList.style.display = 'flex';
  cartSummary.style.display = 'block';
  
  cartList.innerHTML = cart.map(item => {
    const lineTotal = item.price * item.quantity;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-variant">${item.variant}</div>
          <div class="cart-item-price">₹${item.price} × ${item.quantity} = ₹${lineTotal}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
          <span class="qty-display">${item.quantity}</span>
          <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
  
  updateTotals();
}

function updateTotals() {
  let subtotal = 0;
  let gstTotal = 0;
  
  cart.forEach(item => {
    const lineTotal = item.price * item.quantity;
    const lineGst = (lineTotal * item.gstRate) / 100;
    subtotal += lineTotal;
    gstTotal += lineGst;
  });
  
  const grandTotal = subtotal + gstTotal;
  
  document.getElementById('subtotalAmount').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('gstAmount').textContent = `₹${gstTotal.toFixed(2)}`;
  document.getElementById('grandTotal').textContent = `₹${grandTotal.toFixed(2)}`;
}

function saveCartToStorage() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function loadCartFromStorage() {
  const stored = localStorage.getItem(CART_KEY);
  if (stored) {
    cart = JSON.parse(stored);
  }
}

function clearCart() {
  cart = [];
  saveCartToStorage();
  renderCart();
}

function saveTransaction(transaction) {
  const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  transactions.unshift(transaction);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function openCheckout() {
  if (cart.length === 0) {
    showToast('Cart is empty', 'error');
    return;
  }
  
  const modal = document.getElementById('paymentModal');
  const title = document.getElementById('paymentModalTitle');
  const message = document.getElementById('paymentModalMessage');
  const content = document.getElementById('paymentModalContent');
  const actions = document.getElementById('paymentModalActions');
  
  let subtotal = 0;
  let gstTotal = 0;
  cart.forEach(item => {
    const lineTotal = item.price * item.quantity;
    const lineGst = (lineTotal * item.gstRate) / 100;
    subtotal += lineTotal;
    gstTotal += lineGst;
  });
  const grandTotal = subtotal + gstTotal;
  
  title.textContent = 'Select Payment Method';
  message.textContent = 'Choose how you want to pay';
  content.innerHTML = `
    <div class="payment-total">₹${grandTotal.toFixed(2)}</div>
    <div class="payment-methods">
      <button class="payment-method-btn" onclick="selectPaymentMethod('razorpay', ${grandTotal})">
        <div class="payment-method-icon">💳</div>
        <div>Online Payment</div>
        <small style="font-size: 0.75rem; opacity: 0.7;">UPI, Card, Wallet</small>
      </button>
      <button class="payment-method-btn" onclick="selectPaymentMethod('cash', ${grandTotal})">
        <div class="payment-method-icon">💵</div>
        <div>Cash</div>
        <small style="font-size: 0.75rem; opacity: 0.7;">Pay at Counter</small>
      </button>
    </div>
  `;
  actions.innerHTML = `
    <button class="btn btn-secondary" onclick="closePaymentModal()">Cancel</button>
  `;
  
  modal.classList.add('active');
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
}

function selectPaymentMethod(method, amount) {
  if (method === 'razorpay') {
    processRazorpayPayment(amount);
  } else if (method === 'cash') {
    const title = document.getElementById('paymentModalTitle');
    const message = document.getElementById('paymentModalMessage');
    const content = document.getElementById('paymentModalContent');
    const actions = document.getElementById('paymentModalActions');
    
    title.textContent = 'Collect Cash';
    message.textContent = `Collect ₹${amount.toFixed(2)} from the customer and confirm.`;
    content.innerHTML = '';
    actions.innerHTML = `
      <button class="btn btn-primary" onclick="processCashPayment()">Mark as Paid</button>
      <button class="btn btn-secondary" onclick="openCheckout()">Back</button>
    `;
  }
}

function processRazorpayPayment(amount) {
  const amountInPaise = Math.round(amount * 100);
  
  const options = {
    key: RAZORPAY_KEY,
    amount: amountInPaise,
    currency: 'INR',
    name: 'QuickCart',
    description: 'Supermarket Checkout',
    image: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
    handler: function (response) {
      showPaymentSuccess('Razorpay', amount, response.razorpay_payment_id);
    },
    prefill: {
      name: 'Customer',
      email: 'customer@example.com',
      contact: '9999999999'
    },
    notes: {
      items: cart.length,
      session: 'SESSION_' + Date.now()
    },
    theme: {
      color: '#6366f1'
    },
    modal: {
      ondismiss: function() {
        showToast('Payment cancelled', 'error');
      }
    }
  };
  
  const rzp = new Razorpay(options);
  rzp.open();
}

function processCashPayment() {
  let subtotal = 0;
  let gstTotal = 0;
  cart.forEach(item => {
    const lineTotal = item.price * item.quantity;
    const lineGst = (lineTotal * item.gstRate) / 100;
    subtotal += lineTotal;
    gstTotal += lineGst;
  });
  const amount = subtotal + gstTotal;
  
  showPaymentSuccess('Cash', amount, 'CASH_' + Date.now());
}

function showPaymentSuccess(method, amount, paymentId) {
  const title = document.getElementById('paymentModalTitle');
  const message = document.getElementById('paymentModalMessage');
  const content = document.getElementById('paymentModalContent');
  const actions = document.getElementById('paymentModalActions');
  
  const transactionId = 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const transaction = {
    transactionId,
    paymentId,
    items: [...cart],
    amount: amount,
    paymentMethod: method,
    timestamp: new Date().toISOString()
  };
  saveTransaction(transaction);
  
  title.textContent = 'Payment Successful';
  message.textContent = `${method} payment received. Show this QR code at exit.`;
  
  content.innerHTML = `
    <div style="text-align: center; font-size: 4rem; margin: 1rem 0;">✅</div>
    <div id="qrcode" style="display: flex; justify-content: center; margin: 2rem 0;"></div>
    <div style="text-align: center; color: var(--gray); font-size: 0.875rem;">
      <p style="margin-bottom: 0.5rem;"><strong>Transaction ID:</strong></p>
      <p style="font-family: monospace; background: var(--bg-light); padding: 0.5rem; border-radius: 4px; word-break: break-all;">${transactionId}</p>
      <p style="margin-top: 1rem; font-size: 0.75rem; opacity: 0.8;">Show this QR code to security at exit</p>
    </div>
  `;
  
  actions.innerHTML = `
    <button class="btn btn-primary" onclick="newOrder()">New Order</button>
  `;
  
  new QRCode(document.getElementById("qrcode"), {
    text: transactionId,
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function newOrder() {
  clearCart();
  closePaymentModal();
  showToast('Ready for new order', 'success');
}

function showToast(message, type = 'info') {
  let toast;
  if (currentView === 'main') {
    toast = document.getElementById('toast');
  } else if (currentView === 'security') {
    toast = document.getElementById('toastSecurity');
  } else {
    toast = document.getElementById('toastAdmin');
  }
  
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function openQRScanner() {
  document.getElementById('qrScannerModal').classList.add('active');
  
  setTimeout(() => {
    startQRScanner();
  }, 300);
}

function closeQRScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      html5QrCode = null;
    }).catch(err => {
      console.error('Error stopping scanner:', err);
    });
  }
  document.getElementById('qrScannerModal').classList.remove('active');
}

function startQRScanner() {
  html5QrCode = new Html5Qrcode("qrReader");
  
  html5QrCode.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    },
    (decodedText, decodedResult) => {
      console.log('QR Code detected:', decodedText);
      
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      
      closeQRScanner();
      
      document.getElementById('transactionInput').value = decodedText;
      verifyTransaction();
    },
    (errorMessage) => {
    }
  ).catch(err => {
    console.error('Error starting scanner:', err);
    showToast('Camera access denied or not available', 'error');
    closeQRScanner();
  });
}

function verifyTransaction() {
  const input = document.getElementById('transactionInput');
  const transactionId = input.value.trim();
  
  if (!transactionId) {
    showToast('Please enter a transaction ID', 'error');
    return;
  }
  
  const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  const transaction = transactions.find(t => t.transactionId === transactionId);
  
  if (!transaction) {
    showVerificationResult(null, 'not_found');
    showToast('Transaction not found', 'error');
    return;
  }
  
  currentTransaction = transaction;
  
  const exitLog = JSON.parse(localStorage.getItem(EXIT_LOG_KEY) || '[]');
  const alreadyExited = exitLog.find(e => e.transactionId === transactionId);
  
  if (alreadyExited) {
    showVerificationResult(transaction, 'already_exited');
    showToast('Warning: Already exited!', 'warning');
    return;
  }
  
  showVerificationResult(transaction, 'verified');
  showToast('Transaction verified successfully', 'success');
  
  input.value = '';
}

function showVerificationResult(transaction, status) {
  const noVerification = document.getElementById('noVerification');
  const verificationResult = document.getElementById('verificationResult');
  
  noVerification.style.display = 'none';
  verificationResult.style.display = 'block';
  
  let statusHTML = '';
  let detailsHTML = '';
  
  if (status === 'verified') {
    statusHTML = `
      <div class="verification-status verified">
        <span style="font-size: 2rem;">✅</span>
        <span>PAYMENT VERIFIED</span>
      </div>
    `;
    
    const itemsHTML = transaction.items.map(item => `
      <div class="item-row">
        <span>${item.name} (${item.variant}) x${item.quantity}</span>
        <span>₹${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');
    
    detailsHTML = `
      <div class="transaction-details">
        <div class="detail-row">
          <span class="detail-label">Transaction ID:</span>
          <span class="detail-value">${transaction.transactionId}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment Method:</span>
          <span class="detail-value">${transaction.paymentMethod}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment ID:</span>
          <span class="detail-value">${transaction.paymentId}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Amount Paid:</span>
          <span class="detail-value">₹${transaction.amount.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Items Count:</span>
          <span class="detail-value">${transaction.items.length}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date & Time:</span>
          <span class="detail-value">${new Date(transaction.timestamp).toLocaleString()}</span>
        </div>
      </div>
      
      <div class="items-list">
        <strong>Items Purchased:</strong>
        ${itemsHTML}
      </div>
      
      <div class="verification-actions">
        <button class="btn btn-verify" onclick="allowExit()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
          Allow Exit
        </button>
        <button class="btn btn-flag" onclick="flagTransaction()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          Flag for Review
        </button>
      </div>
    `;
  } else if (status === 'already_exited') {
    statusHTML = `
      <div class="verification-status warning">
        <span style="font-size: 2rem;">⚠️</span>
        <span>ALREADY EXITED</span>
      </div>
    `;
    
    detailsHTML = `
      <div class="transaction-details">
        <div class="detail-row">
          <span class="detail-label">Transaction ID:</span>
          <span class="detail-value">${transaction.transactionId}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Amount:</span>
          <span class="detail-value">₹${transaction.amount.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value" style="color: var(--warning);">Customer already exited with this transaction</span>
        </div>
      </div>
      
      <div class="verification-actions">
        <button class="btn btn-flag" onclick="flagTransaction()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
          Flag as Suspicious
        </button>
      </div>
    `;
  } else if (status === 'not_found') {
    statusHTML = `
      <div class="verification-status failed">
        <span style="font-size: 2rem;">❌</span>
        <span>TRANSACTION NOT FOUND</span>
      </div>
    `;
    
    detailsHTML = `
      <div class="transaction-details">
        <p style="text-align: center; color: var(--gray); padding: 2rem;">
          This transaction ID does not exist in the system.<br>
          Please verify the QR code or transaction ID.
        </p>
      </div>
    `;
  }
  
  verificationResult.innerHTML = statusHTML + detailsHTML;
}

function allowExit() {
  if (!currentTransaction) return;
  
  const exitLog = JSON.parse(localStorage.getItem(EXIT_LOG_KEY) || '[]');
  
  const exitEntry = {
    transactionId: currentTransaction.transactionId,
    paymentId: currentTransaction.paymentId,
    amount: currentTransaction.amount,
    items: currentTransaction.items.length,
    status: 'verified',
    exitTime: new Date().toISOString(),
    guardName: 'Security Officer'
  };
  
  exitLog.unshift(exitEntry);
  localStorage.setItem(EXIT_LOG_KEY, JSON.stringify(exitLog));
  
  updateStats('verified');
  loadExitLog();
  
  showToast('Exit allowed. Customer can leave.', 'success');
  
  setTimeout(() => {
    resetVerification();
  }, 2000);
}

function flagTransaction() {
  if (!currentTransaction) return;
  
  const reason = prompt('Enter reason for flagging:');
  if (!reason) return;
  
  const exitLog = JSON.parse(localStorage.getItem(EXIT_LOG_KEY) || '[]');
  
  const exitEntry = {
    transactionId: currentTransaction.transactionId,
    paymentId: currentTransaction.paymentId,
    amount: currentTransaction.amount,
    items: currentTransaction.items.length,
    status: 'flagged',
    flagReason: reason,
    exitTime: new Date().toISOString(),
    guardName: 'Security Officer'
  };
  
  exitLog.unshift(exitEntry);
  localStorage.setItem(EXIT_LOG_KEY, JSON.stringify(exitLog));
  
  updateStats('flagged');
  loadExitLog();
  
  showToast('Transaction flagged for review', 'warning');
  
  setTimeout(() => {
    resetVerification();
  }, 2000);
}

function resetVerification() {
  document.getElementById('noVerification').style.display = 'block';
  document.getElementById('verificationResult').style.display = 'none';
  currentTransaction = null;
}

function updateStats(type) {
  const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{"verified": 0, "flagged": 0}');
  
  if (type === 'verified') {
    stats.verified++;
  } else if (type === 'flagged') {
    stats.flagged++;
  }
  
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  loadStats();
}

function loadStats() {
  const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{"verified": 0, "flagged": 0}');
  
  document.getElementById('verifiedCount').textContent = stats.verified;
  document.getElementById('flaggedCount').textContent = stats.flagged;
}

function loadExitLog() {
  const exitLog = JSON.parse(localStorage.getItem(EXIT_LOG_KEY) || '[]');
  const exitLogContainer = document.getElementById('exitLog');
  
  if (exitLog.length === 0) {
    exitLogContainer.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">No exit records yet</p>';
    return;
  }
  
  exitLogContainer.innerHTML = exitLog.slice(0, 20).map(entry => `
    <div class="exit-log-item ${entry.status}" onclick="showExitDetails('${entry.transactionId}')">
      <div class="exit-log-header-row">
        <span class="exit-log-id">${entry.transactionId}</span>
        <span class="exit-log-status ${entry.status}">${entry.status.toUpperCase()}</span>
      </div>
      <div class="exit-log-details">
        <div>Amount: ₹${entry.amount.toFixed(2)} | Items: ${entry.items}</div>
        <div>Time: ${new Date(entry.exitTime).toLocaleString()}</div>
        ${entry.flagReason ? `<div style="color: var(--warning);">⚠️ ${entry.flagReason}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function refreshExitLog() {
  loadExitLog();
  showToast('Exit log refreshed', 'success');
}

function showExitDetails(transactionId) {
  const exitLog = JSON.parse(localStorage.getItem(EXIT_LOG_KEY) || '[]');
  const entry = exitLog.find(e => e.transactionId === transactionId);
  
  if (!entry) return;
  
  const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  const transaction = transactions.find(t => t.transactionId === transactionId);
  
  const modal = document.getElementById('detailsModal');
  const title = document.getElementById('detailsModalTitle');
  const body = document.getElementById('detailsModalBody');
  
  title.textContent = 'Exit Record Details';
  
  let itemsHTML = '';
  if (transaction && transaction.items) {
    itemsHTML = `
      <div class="items-list" style="margin-top: 1rem;">
        <strong>Items:</strong>
        ${transaction.items.map(item => `
          <div class="item-row">
            <span>${item.name} (${item.variant}) x${item.quantity}</span>
            <span>₹${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  body.innerHTML = `
    <div class="transaction-details">
      <div class="detail-row">
        <span class="detail-label">Transaction ID:</span>
        <span class="detail-value">${entry.transactionId}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment ID:</span>
        <span class="detail-value">${entry.paymentId}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value" style="color: ${entry.status === 'verified' ? 'var(--success)' : 'var(--warning)'};">${entry.status.toUpperCase()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value">₹${entry.amount.toFixed(2)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Items Count:</span>
        <span class="detail-value">${entry.items}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Exit Time:</span>
        <span class="detail-value">${new Date(entry.exitTime).toLocaleString()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Verified By:</span>
        <span class="detail-value">${entry.guardName}</span>
      </div>
      ${entry.flagReason ? `
        <div class="detail-row">
          <span class="detail-label">Flag Reason:</span>
          <span class="detail-value" style="color: var(--warning);">${entry.flagReason}</span>
        </div>
      ` : ''}
    </div>
    ${itemsHTML}
  `;
  
  modal.classList.add('active');
}

function closeDetailsModal() {
  document.getElementById('detailsModal').classList.remove('active');
}

function loadAdminDashboard() {
  loadAdminOverview();
  loadProductsTable();
  loadTransactionsTable();
  loadAdminSecurityReports();
}

function showAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  
  document.getElementById('admin' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
  event.target.closest('.nav-btn').classList.add('active');
  
  currentAdminTab = tabName;
  
  if (tabName === 'overview') loadAdminOverview();
  else if (tabName === 'products') loadProductsTable();
  else if (tabName === 'transactions') loadTransactionsTable();
  else if (tabName === 'security') loadAdminSecurityReports();
}

function loadAdminOverview() {
  const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  const products = getAllProducts();
  const exitLog = JSON.parse(localStorage.getItem(EXIT_LOG_KEY) || '[]');
  const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{"verified": 0, "flagged": 0}');
  
  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
  
  const today = new Date().toDateString();
  const todayTransactions = transactions.filter(t => new Date(t.timestamp).toDateString() === today);
  const todaySales = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  document.getElementById('totalRevenue').textContent = `₹${totalRevenue.toFixed(2)}`;
  document.getElementById('todaySales').textContent = `₹${todaySales.toFixed(2)}`;
  document.getElementById('todayTransactions').textContent = `${todayTransactions.length} transactions`;
  document.getElementById('totalProducts').textContent = products.length;
  document.getElementById('totalExits').textContent = exitLog.length;
  document.getElementById('flaggedExits').textContent = `${stats.flagged} flagged`;
  
  const recentList = document.getElementById('recentTransactionsList');
  if (transactions.length === 0) {
    recentList.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">No transactions yet</p>';
  } else {
    recentList.innerHTML = transactions.slice(0, 5).map(t => `
      <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600; font-size: 0.875rem;">${t.transactionId}</div>
          <div style="font-size: 0.75rem; color: var(--gray);">${new Date(t.timestamp).toLocaleString()}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: var(--admin-primary);">₹${t.amount.toFixed(2)}</div>
          <div style="font-size: 0.75rem; color: var(--gray);">${t.items.length} items</div>
        </div>
      </div>
    `).join('');
  }
  
  const productSales = {};
  transactions.forEach(t => {
    t.items.forEach(item => {
      if (!productSales[item.name]) {
        productSales[item.name] = { name: item.name, quantity: 0, revenue: 0 };
      }
      productSales[item.name].quantity += item.quantity;
      productSales[item.name].revenue += item.price * item.quantity;
    });
  });
  
  const topProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  
  const topList = document.getElementById('topProductsList');
  if (topProducts.length === 0) {
    topList.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 2rem;">No sales data yet</p>';
  } else {
    topList.innerHTML = topProducts.map(p => `
      <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600; font-size: 0.875rem;">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--gray);">${p.quantity} units sold</div>
        </div>
        <div style="font-weight: 700; color: var(--admin-primary);">₹${p.revenue.toFixed(2)}</div>
      </div>
    `).join('');
  }
}

function loadProductsTable() {
  const products = getAllProducts();
  const tbody = document.getElementById('productsTableBody');
  
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--gray);">No products found</td></tr>';
    return;
  }
  
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${p.barcode}</td>
      <td>${p.name}</td>
      <td>${p.variant}</td>
      <td>₹${p.price}</td>
      <td>${p.gstRate}%</td>
      <td>${p.stock}</td>
      <td>
        <div class="table-actions">
          <button class="btn-icon edit" onclick="editProduct('${p.id}')" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon delete" onclick="deleteProduct('${p.id}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddProductModal() {
  document.getElementById('productModalTitle').textContent = 'Add Product';
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('productModal').classList.add('active');
}

function editProduct(productId) {
  const products = getAllProducts();
  const product = products.find(p => p.id === productId);
  
  if (!product) return;
  
  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('productId').value = product.id;
  document.getElementById('productBarcode').value = product.barcode;
  document.getElementById('productName').value = product.name;
  document.getElementById('productVariant').value = product.variant;
  document.getElementById('productPrice').value = product.price;
  document.getElementById('productGst').value = product.gstRate;
  document.getElementById('productCategory').value = product.category;
  document.getElementById('productStock').value = product.stock;
  
  document.getElementById('productModal').classList.add('active');
}

function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  
  let products = getAllProducts();
  products = products.filter(p => p.id !== productId);
  saveProducts(products);
  
  loadProductsTable();
  showToast('Product deleted successfully', 'success');
}

function saveProduct(event) {
  event.preventDefault();
  
  const productId = document.getElementById('productId').value;
  const barcode = document.getElementById('productBarcode').value;
  const name = document.getElementById('productName').value;
  const variant = document.getElementById('productVariant').value;
  const price = parseFloat(document.getElementById('productPrice').value);
  const gstRate = parseInt(document.getElementById('productGst').value);
  const category = document.getElementById('productCategory').value;
  const stock = parseInt(document.getElementById('productStock').value);
  
  let products = getAllProducts();
  
  if (productId) {
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1) {
      products[index] = { id: productId, barcode, name, variant, price, gstRate, category, stock };
    }
  } else {
    const newId = (Math.max(...products.map(p => parseInt(p.id)), 0) + 1).toString();
    products.push({ id: newId, barcode, name, variant, price, gstRate, category, stock });
  }
  
  saveProducts(products);
  closeProductModal();
  loadProductsTable();
  showToast(productId ? 'Product updated successfully' : 'Product added successfully', 'success');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
}

function loadTransactionsTable() {
  const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  const tbody = document.getElementById('transactionsTableBody');
  
  if (transactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--gray);">No transactions found</td></tr>';
    return;
  }
  
  tbody.innerHTML = transactions.map(t => `
    <tr>
      <td>${t.transactionId}</td>
      <td>${new Date(t.timestamp).toLocaleString()}</td>
      <td>${t.items.length}</td>
      <td>₹${t.amount.toFixed(2)}</td>
      <td><span class="badge ${t.paymentMethod.toLowerCase()}">${t.paymentMethod}</span></td>
      <td>
        <button class="btn-icon view" onclick="viewTransactionDetails('${t.transactionId}')" title="View Details">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function filterTransactions() {
  const searchTerm = document.getElementById('transactionSearch').value.toLowerCase();
  const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  const filtered = transactions.filter(t => t.transactionId.toLowerCase().includes(searchTerm));
  
  const tbody = document.getElementById('transactionsTableBody');
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--gray);">No matching transactions</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td>${t.transactionId}</td>
      <td>${new Date(t.timestamp).toLocaleString()}</td>
      <td>${t.items.length}</td>
      <td>₹${t.amount.toFixed(2)}</td>
      <td><span class="badge ${t.paymentMethod.toLowerCase()}">${t.paymentMethod}</span></td>
      <td>
        <button class="btn-icon view" onclick="viewTransactionDetails('${t.transactionId}')" title="View Details">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function viewTransactionDetails(transactionId) {
  const transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  const transaction = transactions.find(t => t.transactionId === transactionId);
  
  if (!transaction) return;
  
  const modal = document.getElementById('transactionDetailsModal');
  const body = document.getElementById('transactionDetailsBody');
  
  const itemsHTML = transaction.items.map(item => `
    <div class="item-row">
      <span>${item.name} (${item.variant}) x${item.quantity}</span>
      <span>₹${(item.price * item.quantity).toFixed(2)}</span>
    </div>
  `).join('');
  
  body.innerHTML = `
    <div class="transaction-details">
      <div class="detail-row">
        <span class="detail-label">Transaction ID:</span>
        <span class="detail-value">${transaction.transactionId}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment ID:</span>
        <span class="detail-value">${transaction.paymentId}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment Method:</span>
        <span class="detail-value">${transaction.paymentMethod}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value">₹${transaction.amount.toFixed(2)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date & Time:</span>
        <span class="detail-value">${new Date(transaction.timestamp).toLocaleString()}</span>
      </div>
    </div>
    <div class="items-list">
      <strong>Items Purchased:</strong>
      ${itemsHTML}
    </div>
  `;
  
  modal.classList.add('active');
}

function closeTransactionDetailsModal() {
  document.getElementById('transactionDetailsModal').classList.remove('active');
}

function loadAdminSecurityReports() {
  const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{"verified": 0, "flagged": 0}');
  const exitLog = JSON.parse(localStorage.getItem(EXIT_LOG_KEY) || '[]');
  
  document.getElementById('adminVerifiedCount').textContent = stats.verified;
  document.getElementById('adminFlaggedCount').textContent = stats.flagged;
  
  const tbody = document.getElementById('exitLogTableBody');
  
  if (exitLog.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--gray);">No exit records found</td></tr>';
    return;
  }
  
  tbody.innerHTML = exitLog.map(e => `
    <tr>
      <td>${e.transactionId}</td>
      <td>${new Date(e.exitTime).toLocaleString()}</td>
      <td>₹${e.amount.toFixed(2)}</td>
      <td>${e.items}</td>
      <td><span class="badge ${e.status}">${e.status.toUpperCase()}</span></td>
      <td>${e.guardName}</td>
    </tr>
  `).join('');
}
