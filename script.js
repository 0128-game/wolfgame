// --- 役職データ定義 ---
const ROLES_DATA = [
    { id: 'villager', name: '市民', side: '市民', action: false },
    { id: 'wolf', name: '人狼', side: '人狼', action: true },
    { id: 'seer', name: '占い師', side: '市民', action: true },
    { id: 'hunter', name: '狩人', side: '市民', action: true },
    { id: 'medium', name: '霊媒師', side: '市民', action: true },
    { id: 'traitor', name: '裏切り者', side: '人狼', action: false },
    { id: 'psycho', name: 'サイコキラー', side: '人狼', action: false },
    { id: 'vampire', name: '吸血鬼', side: '第三', action: false },
    { id: 'toughguy', name: 'タフガイ', side: '市民', action: false },
    { id: 'cosplayer', name: 'コスプレイヤー', side: '市民', action: true },
    { id: 'mentalist', name: 'メンタリスト', side: '人狼', action: false },
    { id: 'magician', name: 'マジシャン', side: '第三', action: true },
    { id: 'dark_medium', name: '闇の霊媒師', side: '市民', action: true },
    { id: 'lovers', name: '恋人', side: '市民', action: false }
];

let players = [];
let currentNightIndex = 0;
let nightLogs = { wolfTarget: null, guardTarget: null, divinedTarget: null };
let lastExecuted = null; // 前日に処刑された人（霊媒用）

// --- 初期設定: 役職入力UI生成 ---
window.onload = () => {
    const ui = document.getElementById('role-assignment-ui');
    if (!ui) return;
    ROLES_DATA.forEach(role => {
        const div = document.createElement('div');
        div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.marginBottom = '8px';
        div.innerHTML = `<span>${role.name}</span><input type="number" class="role-count-input" data-role-id="${role.id}" value="0" min="0" onchange="updateCounts()">`;
        ui.appendChild(div);
    });
};

function updateCounts() {
    const names = document.getElementById('player-names').value.split(',').map(n => n.trim()).filter(n => n !== "");
    document.getElementById('registered-player-count').innerText = names.length;
    let totalRoles = 0;
    document.querySelectorAll('.role-count-input').forEach(input => totalRoles += parseInt(input.value) || 0);
    document.getElementById('total-role-count').innerText = totalRoles;
    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = (totalRoles !== names.length || names.length === 0);
    startBtn.style.opacity = startBtn.disabled ? "0.5" : "1";
}

document.getElementById('player-names').addEventListener('input', updateCounts);

// --- ゲーム開始 ---
function startGame() {
    const names = document.getElementById('player-names').value.split(',').map(n => n.trim()).filter(n => n !== "");
    let rolesPool = [];
    document.querySelectorAll('.role-count-input').forEach(input => {
        const count = parseInt(input.value) || 0;
        const roleBase = ROLES_DATA.find(r => r.id === input.dataset.roleId);
        for (let i = 0; i < count; i++) rolesPool.push({ ...roleBase });
    });
    rolesPool.sort(() => Math.random() - 0.5);
    players = names.map((name, i) => ({
        name: name, role: rolesPool[i].name, roleId: rolesPool[i].id,
        side: rolesPool[i].side, hasAction: rolesPool[i].action, alive: true, target: null
    }));
    document.getElementById('setup-screen').style.display = 'none';
    startNightPhase();
}

// --- 夜フェーズ ---
function startNightPhase() {
    currentNightIndex = 0;
    processNextPlayerNight();
}

function processNextPlayerNight() {
    const display = document.getElementById('display-area');
    const action = document.getElementById('action-area');
    const timerBox = document.getElementById('timer-display');
    timerBox.innerText = "";

    if (currentNightIndex >= players.length) {
        calculateMorning();
        return;
    }

    const p = players[currentNightIndex];
    if (!p.alive) { currentNightIndex++; processNextPlayerNight(); return; }

    display.innerHTML = `<h2>${p.name} さんの番</h2><p>端末を渡し「準備完了」を押してください。</p>`;
    action.innerHTML = `<button class="main-btn" onclick="showRoleAndAction()">準備完了</button>`;
}

function showRoleAndAction() {
    const p = players[currentNightIndex];
    const display = document.getElementById('display-area');
    const action = document.getElementById('action-area');
    
    // 役職ごとの個別情報（占い・霊媒結果）
    let specialInfo = "";
    if (p.roleId === 'seer' && nightLogs.divinedTarget) {
        const target = players.find(t => t.name === nightLogs.divinedTarget);
        specialInfo = `<p style="color:#f1c40f;">【占い結果】${target.name} は 「${target.side === '人狼' ? '人狼' : '人間'}」 です。</p>`;
    }
    if (p.roleId === 'medium' && lastExecuted) {
        specialInfo = `<p style="color:#f1c40f;">【霊媒結果】${lastExecuted.name} は 「${lastExecuted.side === '人狼' ? '人狼' : '人間'}」 でした。</p>`;
    }

    display.innerHTML = `<h3>役職：${p.role}</h3>${specialInfo}<p>対象を選択（20秒）</p>`;
    action.innerHTML = "";

    players.filter(t => t.alive).forEach(t => {
        const btn = document.createElement('button');
        btn.innerText = t.name;
        btn.onclick = () => { if (p.hasAction) p.target = t.name; Array.from(action.children).forEach(b => b.style.backgroundColor = ""); btn.style.backgroundColor = "#27ae60"; };
        action.appendChild(btn);
    });

    let timeLeft = 20;
    const timer = setInterval(() => {
        document.getElementById('timer-display').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (p.roleId === 'wolf') nightLogs.wolfTarget = p.target;
            if (p.roleId === 'hunter') nightLogs.guardTarget = p.target;
            if (p.roleId === 'seer') nightLogs.divinedTarget = p.target;
            currentNightIndex++;
            processNextPlayerNight();
        }
        timeLeft--;
    }, 1000);
}

// --- 朝の計算 ---
function calculateMorning() {
    let deadTonight = [];
    const isGuarded = (nightLogs.wolfTarget && nightLogs.wolfTarget === nightLogs.guardTarget);
    
    if (nightLogs.wolfTarget && !isGuarded) {
        let t = players.find(p => p.name === nightLogs.wolfTarget);
        if (t.roleId === 'psycho') {
            let wolf = players.find(p => p.roleId === 'wolf' && p.alive);
            if(wolf) { wolf.alive = false; deadTonight.push(wolf.name); }
        } else if (t.roleId !== 'toughguy') {
            t.alive = false; deadTonight.push(t.name);
        }
    }
    // 吸血鬼は占われると死亡
    if (nightLogs.divinedTarget) {
        let t = players.find(p => p.name === nightLogs.divinedTarget);
        if (t.roleId === 'vampire') { t.alive = false; if(!deadTonight.includes(t.name)) deadTonight.push(t.name); }
    }

    const display = document.getElementById('display-area');
    const action = document.getElementById('action-area');
    display.innerHTML = `<h2>朝になりました</h2><p>${deadTonight.length === 0 ? "犠牲者はいませんでした。" : "犠牲者は " + deadTonight.join('、') + " です。"}</p>`;
    action.innerHTML = `<button class="main-btn" onclick="startVoting()">議論終了、投票へ</button>`;
    
    nightLogs.guardTarget = null; // 占いと狼のターゲットは次の霊媒・占いのために保持or個別管理
    if(checkWinCondition()) return;
}

// --- 投票 ---
function startVoting() {
    const display = document.getElementById('display-area');
    const action = document.getElementById('action-area');
    display.innerHTML = `<h2>投票タイム</h2><p>追放したい人を1人選んでください。</p>`;
    action.innerHTML = "";
    players.filter(p => p.alive).forEach(p => {
        const btn = document.createElement('button');
        btn.innerText = p.name;
        btn.onclick = () => { if(confirm(`${p.name} に投票しますか？`)) executeVoting(p); };
        action.appendChild(btn);
    });
}

function executeVoting(target) {
    target.alive = false;
    lastExecuted = target; // 霊媒師用
    alert(`${target.name} は追放されました。`);
    if(!checkWinCondition()) startNightPhase();
}

// --- 勝敗判定（吸血鬼対応版） ---
function checkWinCondition() {
    const alivePlayers = players.filter(p => p.alive);
    const wolves = alivePlayers.filter(p => p.side === '人狼').length;
    const nonWolves = alivePlayers.length - wolves;
    const vampireAlive = alivePlayers.some(p => p.roleId === 'vampire');

    let winner = null;
    if (wolves === 0) winner = "市民";
    else if (wolves >= nonWolves) winner = "人狼";

    if (winner) {
        // 吸血鬼が生き残っていれば勝利を奪う
        if (vampireAlive) {
            endGame("吸血鬼の単独勝利！ 影からすべてを支配しました。");
        } else {
            endGame(`${winner}陣営の勝利！`);
        }
        return true;
    }
    return false;
}

function endGame(msg) {
    document.getElementById('display-area').innerHTML = `<h2>ゲーム終了</h2><p>${msg}</p>`;
    document.getElementById('action-area').innerHTML = `<button class="main-btn" onclick="location.reload()">最初から</button>`;
}
