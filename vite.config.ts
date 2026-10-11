import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
  plugins: [{
    name: 'jev-demo-api-proxy',
    configureServer(server) {
      server.middlewares.use('/__jev/status', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ configured: Boolean(env.JEV_API_KEY) }));
      });
      server.middlewares.use('/__jev/decide', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
        const apiKey = env.JEV_API_KEY;
        if (!apiKey) { res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Set JEV_API_KEY in the server environment to enable the real Jev API.' })); return; }
        try {
          let raw = '';
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 64_000) throw new Error('Request body is too large.');
          }
          const input = JSON.parse(raw) as { state: string; model?: string; questions: Record<string, { type: string; instructions: string; options?: string[]; descriptions?: Record<string, string> }> };
          const questions = Object.fromEntries(Object.entries(input.questions).map(([id, question]) => {
            if (question.type === 'choice') {
              const criteria = Object.fromEntries((question.options ?? []).map(option => [option, question.descriptions?.[option] ?? option]));
              return [id, { type: 'choice', instructions: question.instructions, criteria }];
            }
            if (question.type === 'score') return [id, { type: 'score', instructions: question.instructions, criteria: question.options ?? [] }];
            return [id, { type: 'noul', instructions: question.instructions }];
          }));
          const base = (env.JEV_API_BASE_URL ?? 'https://jevmodel.net').replace(/\/+$/, '');
          const upstream = await fetch(`${base}/v1/systemone`, {
            method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
            body: JSON.stringify({ state: input.state, model: input.model ?? env.JEV_MODEL ?? 'jev-latest', questions }),
            signal: AbortSignal.timeout(30_000),
          });
          const data = await upstream.json() as { answers?: Record<string, Record<string, unknown>>; [key: string]: unknown };
          if (!upstream.ok) {
            res.statusCode = upstream.status; res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: (data as { detail?: string; error?: string }).detail ?? (data as { error?: string }).error ?? `Jev API returned ${upstream.status}` })); return;
          }
          const answers = Object.fromEntries(Object.entries(data.answers ?? {}).map(([id, answer]) => {
            if (answer.type === 'choice') {
              const probabilities = (answer.probabilities ?? {}) as Record<string, number>;
              const confidence = Number(answer.confidence ?? Math.max(0, ...Object.values(probabilities)));
              return [id, { type: 'choice', choice: answer.choice, confidence, probabilities }];
            }
            if (answer.type === 'score') {
              const probabilities = (answer.probabilities ?? {}) as Record<string, number>;
              const confidence = Number(answer.confidence ?? Math.max(0, ...Object.values(probabilities)));
              return [id, { ...answer, type: 'score', normalized: answer.normalized ?? 0, level: answer.level ?? String(answer.score ?? ''), confidence, probabilities }];
            }
            const probability = Number(answer.noul ?? answer.probability ?? 0);
            return [id, { type: 'noul', answer: probability >= 0.5, probability, confidence: Math.max(probability, 1 - probability) }];
          }));
          res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ answers }));
        } catch (error) {
          res.statusCode = 400; res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid request.' }));
        }
      });
    },
  }],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  };
});
