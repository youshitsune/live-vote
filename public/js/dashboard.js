const socket = io();
let authed = false;
let token = null;

function toast(m) {
    const t = document.getElementById('toast');
    t.textContent = m;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1600);
}

document.getElementById('loginBtn').onclick = () => {
    const pw = document.getElementById('pw').value;
    socket.emit('admin:auth', {password:pw}, (r) => {
        if (r && r.ok) {
            authed=true;
            document.getElementById('loginwrap').style.display='none';
            document.getElementById('app').style.display='block';
            toast('Logged in');
        } else {
            document.getElementById('lerr').style.display='block';
        }
    });
};
document.getElementById('pw').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginBtn').click();});

socket.on('admin:tokenUpdate', ({token_new}) => {
    token = token_new;
    document.getElementById('token').innerHTML = `Current token: ${token}`;
    console.log(token);
});

let lastState = null;
socket.on('state', (s) => {
    lastState = s;
    document.getElementById('nowq').textContent = s.question || '— (lobby) —';
    document.getElementById('qidx').textContent = s.questionIndex;
    document.getElementById('qtotal').textContent = s.total;
    const res = document.getElementById('results');
    res.innerHTML = '';
    if (s.options && s.options.length) {
        s.options.forEach((opt,i)=>{
            const d=document.createElement('div');
            d.className='optbar';
            const pct=s.percentages[i]||0;
            const cnt=s.counts[i]||0;
            d.innerHTML='<div class="fill" style="width:'+pct+'%"></div><div class="txt"><span>'+escapeHtml(opt)+'</span><span>'+pct+'% · '+cnt+'</span></div>';
            res.appendChild(d);
        });
    }

    window.__qs = (s.questions && s.questions.length) ? s.questions : (window.__qs||[]);
    renderQList();
});

if (!window.__qs) window.__qs = [
    'What is your favourite color?',
    'Coffee or Tea?',
    'Remote or in-office?'
];

function renderQList(){
    const ql=document.getElementById('qlist');
    const s=lastState; if(!s) return;

    let list = window.__qs.slice(0,s.totalQuestions);

    while (list.length < s.totalQuestions) { list.push('Question '+(list.length+1)); }
    ql.innerHTML='';
    list.forEach((t,i)=>{
        const d=document.createElement('div');
        d.className='qitem'+(i===s.questionIndex?' active':'');
        d.innerHTML='<span class="idx">'+(i+1)+'</span><span class="t">'+escapeHtml(t)+'</span>';
        d.onclick=()=> socket.emit('admin:goto',{index:i});

        const rb=document.createElement('button');
        rb.textContent='×'; rb.style.padding='2px 8px'; rb.style.fontSize='12px';
        rb.onclick= (e) => {
            e.stopPropagation();
            if (confirm('Remove question?')) {
                socket.emit('admin:removeQuestion',{index:i});
            }
        };
        d.appendChild(rb);
        ql.appendChild(d);
    });
}

document.getElementById('nextBtn').onclick = ()=> socket.emit('admin:next');
document.getElementById('prevBtn').onclick = ()=> socket.emit('admin:prev');
document.getElementById('resetBtn').onclick = ()=> { if(confirm('Reset all votes for current question?')) socket.emit('admin:resetVotes'); };

document.getElementById('addBtn').onclick = () => {
    const text = document.getElementById('newq').value.trim();
    const opts = document.getElementById('newopts').value.split('\n').map(x=>x.trim()).filter(Boolean);
    if (!text || opts.length<2) { toast('Need question + >=2 options'); return;}
    socket.emit('admin:addQuestion',{text,options:opts});
    window.__qs.push(text);
    document.getElementById('newq').value='';
    document.getElementById('newopts').value='';
    toast('Added');
};

document.getElementById('tokenBtn').onclick = () => {
    socket.emit('admin:setToken',{token:document.getElementById('tokeninp').value});
    toast('Token set');
};

function escapeHtml(s) { 
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); 
}

