// account.js - DÜZELTİLMİŞ ve TAM ÇALIŞAN VERSİYON

// ✅ PRICE_ID sabiti en başta tanımlandı (global scope)
const PRICE_ID = 'pri_01k4ertq7jkbb25tb9s1g77t49';

document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const emailInput = document.getElementById('email');
    const linkEmailBtn = document.getElementById('linkEmailBtn');
    const buyBtn = document.getElementById('buyBtn');

    // Sayfa yüklendiğinde durumu kontrol et
    checkStatus();

    async function checkStatus() {
        statusElement.className = 'alert alert-info';
        statusElement.innerHTML = '<strong>Checking your license status...</strong>';

        try {
            // DeviceId al
            const items = await chrome.storage.local.get(['deviceId']);
            const deviceId = items.deviceId || crypto.randomUUID();
            await chrome.storage.local.set({ deviceId });

            // Önce kullanıcıyı kaydet (ensureUser)
            await chrome.runtime.sendMessage({
                type: 'register',
                deviceId: deviceId
            });

            // Sonra durumu sorgula
            const response = await chrome.runtime.sendMessage({ 
                type: 'get_license_status',
                deviceId: deviceId
            });

            if (response && response.error) {
                throw new Error(response.error);
            }

            // Durumu göster
            if (response.plan === 'pro') {
                statusElement.className = 'alert alert-success';
                statusElement.innerHTML = `
                    <strong>🎉 Premium Member</strong><br>
                    Your subscription is <strong>active</strong>. Thank you!
                    ${response.account ? `<br>Linked to: ${response.account.email}` : ''}
                `;
                buyBtn.innerText = 'Manage Subscription';
                buyBtn.className = 'btn btn-info';
            } else if (response.plan === 'trial') {
                statusElement.className = 'alert alert-warning';
                statusElement.innerHTML = `
                    <strong>⏳ Trial Active</strong><br>
                    <strong>${response.trialDaysRemaining}</strong> days remaining.<br>
                    <strong>Unlimited</strong> daily usage during trial.
                `;
                buyBtn.style.display = 'block';
            } else {
                statusElement.className = 'alert alert-secondary';
                statusElement.innerHTML = `
                    <strong>🔓 Free Plan</strong><br>
                    <strong>${response.freeDailySecondsRemaining}</strong> free seconds left today.
                `;
                buyBtn.style.display = 'block';
            }
        } catch (error) {
            console.error('Status check error:', error);
            statusElement.className = 'alert alert-danger';
            statusElement.innerHTML = '<strong>Error</strong> Could not check your status. Please try again.';
        }
    }

    // Email'i bu cihazla ilişkilendir
    linkEmailBtn.onclick = async function() {
        const email = emailInput.value.trim();
        if (!email) {
            alert('Please enter a valid email address.');
            return;
        }
        
        await chrome.storage.local.set({ userEmail: email });
        alert(`Email "${email}" has been linked to this device for identification.`);
    };

    // Satın alma sayfasını aç
    buyBtn.onclick = async function() {
        const email = emailInput.value.trim() || '';

        // Get deviceId from chrome.storage.local (created by background Paddle.init)
        chrome.storage.local.get(['deviceId'], items => {
            const deviceId = (items && items.deviceId) ? items.deviceId : '';

            const params = new URLSearchParams({
                price_id: PRICE_ID,
                email: email,
                deviceId: deviceId
            });

            const url = `https://muvusoft.site/serv_chr_talks/pay.html?${params.toString()}`;
            window.location.href = url;
        });
    };
});
