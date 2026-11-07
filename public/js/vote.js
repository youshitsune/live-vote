function renderOptions(s){
    const wrap = document.getElementById('opts');
    wrap.innerHTML = '';
    s.options.forEach((opt,i)=>{
        const btn = document.createElement('button');
        btn.className = 'opt';
        btn.dataset.idx = i;
        btn.disabled = myVoted;
        if (i===myChoice) btn.classList.add('chosen');
        btn.innerHTML = '<span>'+escapeHtml(opt)+'</span>';
        btn.onclick = () => {
            if (myVoted) return;
            socket.emit('vote', { optionIndex: i });
            myVoted = true; myChoice = i;
            document.querySelectorAll('.opt').forEach((b,j)=>{ b.disabled=true; if(j===i) b.classList.add('chosen'); });
            document.getElementById('badge').innerHTML = '<div class="voted-badge">✓ Vote recorded</div>';
        };
        wrap.appendChild(btn);
    });
}

function escapeHtml(s){ 
    return String(s).replace(/[&<>"']/g,
        c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
    ); 
}

const sid = localStorage.getItem('lv_voter') || (crypto.randomUUID?crypto.randomUUID():'v'+Math.random().toString(36).slice(2));
localStorage.setItem('lv_voter',sid);


const socket = io();
let myChoice = null;
let myVoted = false;
let currentIdx = null;

socket.on('connect', () => socket.emit('identify', { voterId: sid }));

socket.on('state', (s) => {
    document.getElementById('title').textContent = s.title || 'Live Vote';
    if (s.questionIndex < 0 || !s.question) {
        document.getElementById('lobby').style.display='block';
        document.getElementById('qcard').style.display='none';
        currentIdx = s.questionIndex;
        myVoted = false; myChoice = null;
        return;
    }
    if (currentIdx !== s.questionIndex) {
        currentIdx = s.questionIndex;
        myVoted = false; myChoice = null;
    }
    document.getElementById('lobby').style.display='none';
    document.getElementById('qcard').style.display='block';
    document.getElementById('qtext').textContent = s.question;
    renderOptions(s);
    const badge = document.getElementById('badge');
    badge.innerHTML = myVoted ? '<div class="voted-badge">✓ Vote recorded</div>' : '';
    document.getElementById('meta').textContent = '';
});

socket.on('you', (y) => {
    myVoted = !!y.voted;
    myChoice = (y.voted ? y.choice : null);
    const badge = document.getElementById('badge');
    badge.innerHTML = myVoted ? '<div class="voted-badge">✓ Vote recorded</div>' : '';
    document.querySelectorAll('.opt').forEach((b,i)=>{
        if (myVoted) b.disabled = true;
        if (i===myChoice) b.classList.add('chosen');
    });
});

socket.on('reset', () => { myVoted=false; myChoice=null; });

