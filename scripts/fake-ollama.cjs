/**
 * Minimal stand-in for an Ollama server, used to test the local-model path
 * without a GPU. Speaks /api/tags, /api/embed, /v1/chat/completions and /api/chat.
 */
const http = require('http');

const MODELS = [
  { name: 'qwen3:4b', size: 2684354560, details: { parameter_size: '4.0B', family: 'qwen3' }, modified_at: '2025-09-20T10:00:00Z' },
  { name: 'qwen3:14b', size: 9985798963, details: { parameter_size: '14.8B', family: 'qwen3' }, modified_at: '2025-09-06T10:00:00Z' },
  { name: 'qwen2.5-coder:14b', size: 9663676416, details: { parameter_size: '14.7B', family: 'qwen2' }, modified_at: '2025-08-29T10:00:00Z' },
  { name: 'llama3.1:8b', size: 5261334937, details: { parameter_size: '8.0B', family: 'llama' }, modified_at: '2025-09-24T10:00:00Z' },
  { name: 'nomic-embed-text:latest', size: 287309824, details: { parameter_size: '137M', family: 'nomic-bert' }, modified_at: '2025-09-01T10:00:00Z' },
];

const calls = [];

function vec(text) {
  const v = new Array(32).fill(0);
  for (const word of String(text).toLowerCase().match(/[a-z]{3,}/g) || []) {
    let h = 0;
    for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) % 32;
    v[h] += 1;
  }
  return v;
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (code, payload) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    calls.push(`${req.method} ${req.url}`);

    if (req.url === '/api/tags') return json(200, { models: MODELS });

    if (req.url === '/api/embed') {
      const input = JSON.parse(body || '{}').input;
      const list = Array.isArray(input) ? input : [input];
      return json(200, { embeddings: list.map(vec) });
    }

    if (req.url === '/v1/chat/completions') {
      const parsed = JSON.parse(body || '{}');
      const system = parsed.messages?.[0]?.content ?? '';
      const user = parsed.messages?.[1]?.content ?? '';
      const wantsJson = Boolean(parsed.response_format) || /strict JSON/.test(system) || /Return ONLY JSON/.test(user);
      const content = wantsJson
        ? JSON.stringify({
            title: 'Teams lose the thread after the kickoff call',
            statement:
              'How might we help product teams keep one problem statement alive from the first conversation through to a launched, measured release?',
            summary:
              'The room keeps returning to lost context between the kickoff and delivery: decisions are made verbally and never captured. Evidence is thin and no measurable cost has been attached yet. The cheapest next step is three customer calls.',
            confidence: 82,
            users: ['product managers', 'founders', 'engineering leads'],
            pains: ['Decisions live in chat history nobody re-reads', 'Scope is re-litigated every sprint'],
            evidence: ['Three teammates described rework in the last month'],
            assumptions: ['The team meets weekly', 'One workspace can replace six tools'],
            unknowns: ['What does one week of rework cost?', 'Who signs off scope?'],
            successMetrics: ['Time from kickoff to first release under 14 days'],
            solutionAngles: ['One timeline of decisions', 'A problem statement that gates scope'],
            productType: 'Collaboration tool',
            tags: ['decisions', 'scope', 'rework', 'context'],
            signals: [
              { type: 'pain', label: 'Decisions are not written down', detail: 'Re-raised every sprint', score: 84 },
              { type: 'decision', label: 'One workspace instead of six tools', detail: 'Team agreed on Monday', score: 76 },
            ],
          })
        : `## Read of the room\n\nYou are in a solid place: the problem statement is approved and the board has work in flight, but **three of the launch documents are still drafts**.\n\nThe cheapest unblock is to finish the pricing sheet, because it gates the landing copy.\n\n**Next:** draft Pricing & Packaging in Launch with the free-tier numbers you already collected.`;

      return json(200, {
        id: 'chatcmpl-fake',
        model: parsed.model,
        choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { total_tokens: 128 },
      });
    }

    if (req.url === '/api/chat') {
      const parsed = JSON.parse(body || '{}');
      return json(200, { message: { role: 'assistant', content: 'native endpoint reply' }, model: parsed.model });
    }

    if (req.url === '/__calls') return json(200, { calls });

    return json(404, { error: 'not found' });
  });
});

server.listen(11434, '0.0.0.0', () => console.log('fake ollama on 11434'));
