// ========================= /public/index.js =========================

// Shortcut
const $ = id => document.getElementById(id);

// =====================================================
// Telegram
// =====================================================
function getUserID() {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
}

// =====================================================
// API Helper
// =====================================================
async function api(body) {
    const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return res.json();
}

// =====================================================
// Page Navigation
// =====================================================
document.querySelectorAll("[data-page-target]").forEach(btn => {
    btn.onclick = () => openPage(btn.dataset.pageTarget);
});

function openPage(id) {
    document.querySelectorAll(".page, #home")
        .forEach(p => p.classList.remove("active"));
    $(id).classList.add("active");
}

// =====================================================
// Loader
// =====================================================
function hideLoader() {
    setTimeout(() => { $("loaderOverlay").style.display = "none"; }, 600);
}

// =====================================================
// Init User
// =====================================================
async function initUser() {
    const user_id = getUserID();
    if (!user_id) return alert("Telegram not detected");

    const user = await api({ action: "init_user", user_id });

    if (!user.length) {
        await api({
            action: "create_user",
            user_id,
            ref_by: getRef()
        });
    }

    await loadBalances();
    showRefLink();
    hideLoader();
}

function getRef() {
    const p = new URLSearchParams(location.search);
    return p.get("ref") || null;
}

// =====================================================
// Load Balances + Update UI
// =====================================================
async function loadBalances() {
    const user_id = getUserID();
    const data = await api({ action: "init_user", user_id });

    if (!data.length) return;

    const u = data[0];

    $("points").textContent = u.points;
    $("usdt").textContent = u.usdt.toFixed(3);
    $("ton").textContent = u.ton.toFixed(3);

    $("taskAdsCount").textContent = `${u.ads_today}/300`;
}

// =====================================================
// Ads Button
// =====================================================
$("adsBtn").onclick = async () => {
    const user_id = getUserID();

    const r = await api({ action: "task_ads", user_id });

    if (r.error === "limit") {
        showNotif();
        return;
    }

    await loadBalances();
};

function showNotif() {
    const n = $("notifBar");
    n.style.display = "block";
    setTimeout(() => n.style.display = "none", 2000);
}

// =====================================================
// Swap – Convert Points => USDT
// =====================================================
$("pointsInput").oninput = e => {
    const pts = parseInt(e.target.value || 0);
    $("usdtValueDisplay").textContent = (pts / 100000).toFixed(2);
};

$("convertBtn").onclick = async () => {
    const pts = parseInt($("pointsInput").value);
    if (pts < 100000) return msg("swapMsg", "Minimum 100k points", true);

    const r = await api({
        action: "convert_points",
        user_id: getUserID(),
        points: pts
    });

    if (r.error) return msg("swapMsg", r.error, true);

    msg("swapMsg", "Converted!", false);
    await loadBalances();
};

// =====================================================
// Withdraw
// =====================================================
$("withdrawButton").onclick = async () => {
    const amount = parseFloat($("withdrawAmount").value);
    const uid = $("binanceUID").value;

    if (amount < 0.03)
        return msg("withdrawMsg", "Minimum 0.03", true);

    const r = await api({
        action: "withdraw",
        user_id: getUserID(),
        amount,
        binance_uid: uid
    });

    if (r.error) return msg("withdrawMsg", r.error, true);

    msg("withdrawMsg", "Withdrawal request sent!", false);
    await loadBalances();
};

// =====================================================
// Tasks – Join Channel
// =====================================================
$("taskJoinBtn").onclick = async () => {
    const r = await api({
        action: "task_join",
        user_id: getUserID()
    });

    if (r.error) return msg("taskMsg", r.error, true);

    msg("taskMsg", "Task completed!", false);
    await loadBalances();
};

// =====================================================
// Referrals
// =====================================================
async function showRefLink() {
    const uid = getUserID();
    const link = `https://t.me/Game_win_usdtBot?start=${uid}`;
    $("refLinkDisplay").textContent = link;

    $("copyBtn").onclick = async () => {
        await navigator.clipboard.writeText(link);
        $("copyMsg").style.opacity = 1;
        setTimeout(() => $("copyMsg").style.opacity = 0, 1200);
    };

    const refs = await api({ action: "get_referrals", user_id: uid });
    $("refCount").textContent = refs.length;
}

// =====================================================
// Add Task (TON)
// =====================================================
document.querySelectorAll(".user-option-btn").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".user-option-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        $("targetUsers").value = btn.dataset.users;

        $("totalTonCost").textContent = (btn.dataset.users / 1000).toFixed(2);
    };
});

$("addTonTaskBtn").onclick = async () => {
    const link = $("taskLink").value;
    const target = parseInt($("targetUsers").value);

    const r = await api({
        action: "add_task",
        user_id: getUserID(),
        link,
        target_users: target
    });

    if (r.error) return msg("addTaskMsg", r.error, true);

    msg("addTaskMsg", "Task created!", false);
};

// =====================================================
// TON CONNECT SETUP
// =====================================================
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: "https://index-html-lord56-f94e.vercel.app/tonconnect-manifest.json"
});

// Connect Wallet
$("connectWallet").onclick = async () => {
    try {
        await tonConnectUI.connectWallet();
        const addr = tonConnectUI.account?.address;

        $("walletStatus").textContent = "Connected";
        $("walletAddress").style.display = "block";
        $("walletAddress").textContent = addr;

    } catch (e) {
        $("walletStatus").textContent = "Connection Failed";
    }
};

// Deposit TON
$("deposit-btn").onclick = async () => {
    if (!tonConnectUI.connected)
        return msg("tonDepositMsg", "Connect wallet first", true);

    try {
        const tx = {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [{
                address: "YOUR_TON_WALLET",
                amount: (0.1 * 1e9).toString()
            }]
        };

        await tonConnectUI.sendTransaction(tx);

        msg("tonDepositMsg", "Deposit Received!", false);

        await api({
            action: "ton_deposit",
            user_id: getUserID(),
            ton: 0.1
        });

        await loadBalances();

    } catch (e) {
        msg("tonDepositMsg", "Transaction Cancelled", true);
    }
};

// =====================================================
// Message Helper
// =====================================================
function msg(id, text, isErr) {
    const el = $(id);
    el.textContent = text;
    el.className = isErr ? "error" : "success";
    el.style.opacity = 1;
    setTimeout(() => el.style.opacity = 0, 2000);
}

// =====================================================
// Start
// =====================================================
initUser();