// ============================================================
//  AI Config
// ============================================================
const AI = {
  endpoint: 'https://aiweek2026.openai.azure.com/',
  deployment: 'gpt-5.1',
  apiVersion: '2025-03-01-preview',
  key: 'PASTE-YOUR-NEW-KEY-HERE'   // ⚠️ See security note at the bottom
};

const INSTRUCTIONS = `
You are YieldLogic's assistant. YieldLogic helps farmers forecast annual crop yield and revenue.

DETAILS TO COLLECT (same as the YieldLogic calculator):
crop(s); hectares; location; soil type; expected selling price per ton (Rands); production cost per hectare (Rands);
last season's yield (kg per hectare); irrigation (yes/no and type); pests or diseases.

HOW TO BEHAVE
- Farmers can give details in any order. Remember everything said earlier in this conversation. If a value is corrected, the latest value wins.
- Ask for missing details at most 3 at a time. Do not wait for everything: once you know at least the crop, hectares and last season's yield, you can forecast. State any assumptions you made for missing details.
- When asked for a forecast, or when the details change, give:
  Yield per hectare: low / expected / high (kg)
  Total yield = kg per hectare x hectares
  Revenue = total kg / 1000 x price per ton
  Profit = revenue - (cost per hectare x hectares)
  Show each calculation step by step, in Rands.
- Anchor the forecast on last season's yield and adjust for soil, irrigation, pests and location. If you are unsure about a crop or region, stay within 25% of last season's yield and say so.
- "What if" questions (for example a different price): recompute using the stored details.
- Only discuss farming, crop yield and farm income; politely decline anything else.
- Short, plain language. Plain text only, no markdown.
- Forecasts are estimates, not guarantees. Never invent market prices, subsidies or regulations; if you lack current data, say so.
- For pesticides, follow the product label and suggest a local agronomist.
`;

// ============================================================
//  Conversation store (persists in localStorage)
// ============================================================
const STORE_KEY = 'yieldlogic-chat';
const MAX_MESSAGES = 40;

let conversation = loadChat();
let busy = false;

function loadChat() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function saveChat() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(conversation)); } catch {}
}

// ============================================================
//  DOM refs
// ============================================================
const chatBox    = document.getElementById('chatBox');
const chatInput  = document.getElementById('chatInput');
const chatWindow = document.getElementById('chatWindow');
const chatToggle = document.getElementById('chatToggle');
const chatSend   = document.getElementById('chatSend');
const chatNew    = document.getElementById('chatNew');

// ============================================================
//  Rendering
// ============================================================
function addMsg(role, text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message ' + role;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '🧑‍🌾' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;

  return bubble;   // return the bubble so callers can update text later
}

function renderChat() {
  chatBox.innerHTML = '';
  if (!conversation.length) {
    addMsg('ai',
      "Hi! 🌱 Tell me about your farm — what you grow, how many hectares, where, " +
      "your soil, last season's yield, your selling price and costs. " +
      "Then I'll forecast your yield and revenue."
    );
  } else {
    conversation.forEach(m =>
      addMsg(m.role === 'assistant' ? 'ai' : 'user', m.content)
    );
  }
}

// ============================================================
//  Toggle open / close
// ============================================================
function toggleChat() {
  const isOpen = chatWindow.classList.toggle('open');
  chatToggle.innerHTML = isOpen ? '✖' : '💬';
}

chatToggle.addEventListener('click', toggleChat);

// ============================================================
//  New chat (start over)
// ============================================================
chatNew.addEventListener('click', () => {
  if (confirm('Clear the chat and start with a new farm?')) {
    conversation = [];
    saveChat();
    renderChat();
  }
});

// ============================================================
//  AI call
// ============================================================
async function askAI() {
  const res = await fetch(
    `${AI.endpoint}openai/responses?api-version=${AI.apiVersion}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AI.key
      },
      body: JSON.stringify({
        model: AI.deployment,
        instructions: INSTRUCTIONS,
        input: conversation,
        reasoning: { effort: 'low' },
        max_output_tokens: 1200
      })
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  let text = '';
  for (const item of data.output || [])
    for (const c of item.content || [])
      if (c.type === 'output_text') text += c.text;

  return text || data.output_text || '';
}

// ============================================================
//  Send a message
// ============================================================
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || busy) return;

  busy = true;
  chatInput.value = '';

  if (!conversation.length) chatBox.innerHTML = '';   // remove greeting

  addMsg('user', text);
  conversation.push({ role: 'user', content: text });

  const thinkingBubble = addMsg('ai', '');
  thinkingBubble.classList.add('thinking');

  try {
    const reply = await askAI();
    thinkingBubble.classList.remove('thinking');
    thinkingBubble.textContent = reply || 'Sorry, I could not come up with an answer.';
    conversation.push({ role: 'assistant', content: thinkingBubble.textContent });
    conversation = conversation.slice(-MAX_MESSAGES);
    saveChat();
  } catch (err) {
    console.error(err);
    thinkingBubble.classList.remove('thinking');
    thinkingBubble.textContent = '⚠️ I could not reach the AI. Please try again.';
    conversation.pop();   // keep history valid
  } finally {
    busy = false;
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
});

// ============================================================
//  Initial render
// ============================================================
renderChat();