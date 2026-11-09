# Live Vote

## DISCLAIMER: This project was bootstrapped by AI

Real-time voting platform. Host controls questions; all connected phones update instantly via WebSocket (Socket.IO). ~14ms push latency for 50 clients.

## Run

```sh
cd live-vote
ADMIN_PASS=yourpassword PORT=3000 TOKEN=yourtoken node server.js
```

- Voter page: http://localhost:3000/vote.html?token=yourtoken (yourtoken: TOKEN, default `test`)
- Host dashboard: http://localhost:3000/dashboard.html  (password: ADMIN_PASS, default `admin123`)

## How it works

- Each phone stores a random device id in localStorage (anonymous, one vote per device per question).
- Host clicks "Next" → server broadcasts new question to every connected client (no refresh needed).
- Voting totals tally on the server and broadcast to everyone in real time.
- Switching questions clears votes for the previous question.
