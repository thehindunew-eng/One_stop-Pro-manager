import { NextResponse } from 'next/server';
import { ensureBase, findProject } from '@/lib/repo';
import { DEMO_CODE, PROD_CODE } from '@/lib/repo';
import { engineKind } from '@/lib/db';
import { engineLabel } from '@/lib/ai';
import { listMembers, listStages, listTools } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    await ensureBase();
    const [live, demo, tools, stages] = await Promise.all([
      findProject(PROD_CODE),
      findProject(DEMO_CODE),
      listTools(true),
      listStages(true),
    ]);
    const [liveMembers, demoMembers] = await Promise.all([
      live ? listMembers(live.id) : Promise.resolve([]),
      demo ? listMembers(demo.id) : Promise.resolve([]),
    ]);
    const ai = engineLabel();
    return NextResponse.json({
      ok: Boolean(live && demo),
      database: await engineKind(),
      rooms: {
        live: live
          ? { code: live.code, name: live.name, stage: live.stage_key, members: liveMembers.length, url: `/room/${live.code}` }
          : null,
        demo: demo
          ? { code: demo.code, name: demo.name, stage: demo.stage_key, members: demoMembers.length, url: `/room/${demo.code}` }
          : null,
      },
      catalogue: { tools: tools.length, stages: stages.length },
      ai: { engine: ai.engine, live: ai.live },
      missing: [!live && `live room "${PROD_CODE}"`, !demo && `demo room "${DEMO_CODE}"`].filter(Boolean),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, hint: 'Check DATABASE_URL and that the database accepts connections.' },
      { status: 500 },
    );
  }
}
