const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const PORT = process.env.PORT || 3000;
let TOKEN = process.env.TOKEN || 'test';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' }, pingTimeout: 20000, pingInterval: 10000 });

app.use(express.json());
app.use(express.static('public'));

const state = {
    questions: [
        { text: 'What is your favourite color?', options: ['Red', 'Blue', 'Green', 'Yellow'] },
        { text: 'Coffee or Tea?', options: ['Coffee ☕', 'Tea 🍵', 'Both', 'Neither'] },
        { text: 'Remote or in-office?', options: ['Remote', 'In-office', 'Hybrid'] },
    ],
    currentIndex: -1,
    votes: new Map(),
};

function tally() {
    const q = state.currentIndex >= 0 ? state.questions[state.currentIndex] : null;
    const counts = q ? q.options.map(() => 0) : [];
    let total = 0;
    for (const idx of state.votes.values()) {
        if (idx >= 0 && idx < counts.length) { counts[idx]++; total++; }
    }
    return { counts, total, percentages: counts.map(c => total ? Math.round(c/total*100) : 0) };
}

function publicState() {
    const q = state.currentIndex >= 0 ? state.questions[state.currentIndex] : null;
    return {
        questionIndex: state.currentIndex,
        totalQuestions: state.questions.length,
        questions: state.questions.map(qq => qq.text),
        question: q ? q.text : null,
        options: q ? q.options : [],
        ...tally(),
    };
}

const socketToVoter = new Map();
const admins = new Set();

function broadcastState() {
    io.emit('state', publicState());
}

io.on('connection', (socket) => {
    socket.emit('state', publicState());

    socket.on('identify', ({ voterId, token }, cb) => {
        if (token !== TOKEN) {
            if (typeof cb === 'function') cb({ok: false});
            socket.disconnect();
            return;
        }

        if (typeof voterId === 'string' && voterId.length > 0) {
            socketToVoter.set(socket.id, voterId);
            const voted = state.votes.has(voterId);
            socket.emit('you', { voterId, voted, choice: voted ? state.votes.get(voterId) : null });
            if (typeof cb === 'function') cb({ok: true});
        }
    });

    socket.on('admin:auth', ({ password }, cb) => {
        if (password === ADMIN_PASS) {
            admins.add(socket.id);
            socket.emit('admin:tokenUpdate', {token_new: TOKEN});
            if (typeof cb === 'function') cb({ ok: true });
        } else {
            if (typeof cb === 'function') cb({ ok: false });
        }
    });

    function isAdmin() { return admins.has(socket.id); }

    socket.on('admin:addQuestion', ({ text, options }) => {
        if (!isAdmin()) return;
        if (!text || !Array.isArray(options) || options.length < 2) return;
        state.questions.push({ text: String(text).trim(), options: options.map(o=>String(o).trim()).filter(Boolean) });
        broadcastState();
    });

    socket.on('admin:removeQuestion', ({ index }) => {
        if (!isAdmin()) return;
        if (index < 0 || index >= state.questions.length) return;
        state.questions.splice(index, 1);
        if (state.currentIndex >= state.questions.length) state.currentIndex = state.questions.length - 1;
        state.votes.clear();
        broadcastState();
    });

    socket.on('admin:setToken', ({ token }) => {
        if (!isAdmin()) return;
        TOKEN = token;
        socket.emit('admin:tokenUpdate', {token_new: token});
    });

    socket.on('admin:next', () => {
        if (!isAdmin()) return;
        if (state.currentIndex < state.questions.length - 1) {
            state.currentIndex++;
            state.votes.clear();
            broadcastState();
        }
    });

    socket.on('admin:prev', () => {
        if (!isAdmin()) return;
        if (state.currentIndex > 0) {
            state.currentIndex--;
            state.votes.clear();
            broadcastState();
        } else if (state.currentIndex === 0) {
            state.currentIndex = -1;
            state.votes.clear();
            broadcastState();
        }
    });

    socket.on('admin:goto', ({ index }) => {
        if (!isAdmin()) return;
        if (index < -1 || index >= state.questions.length) return;
        state.currentIndex = index;
        state.votes.clear();
        broadcastState();
    });

    socket.on('admin:resetVotes', () => {
        if (!isAdmin()) return;
        state.votes.clear();
        broadcastState();
        io.emit('reset');
    });

    socket.on('vote', ({ optionIndex }) => {
        const voterId = socketToVoter.get(socket.id);
        if (!voterId) return;
        const q = state.currentIndex >= 0 ? state.questions[state.currentIndex] : null;
        if (!q) return;
        if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= q.options.length) return;
        if (state.votes.has(voterId)) return;
        state.votes.set(voterId, optionIndex);
        socket.emit('you', { voterId, voted: true, choice: optionIndex });
        broadcastState();
    });

    socket.on('disconnect', () => {
        admins.delete(socket.id);
        socketToVoter.delete(socket.id);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Live Vote running on http://localhost:${PORT}/vote.html?token=${TOKEN}`);
    console.log(`Host dashboard: http://localhost:${PORT}/dashboard.html  (password: ${ADMIN_PASS})`);
});

