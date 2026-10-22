const appRoot = new URL("../", import.meta.url);

try {
  const response = await fetch(new URL('api/agents', appRoot), { signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error();
  const agents = await response.json();
  for (const agent of agents) {
    const card = document.createElement('li');
    card.className = 'card';
    const title = document.createElement('h2');
    const link = document.createElement('a');
    link.href = new URL(`${encodeURIComponent(agent.id)}/`, appRoot).href;
    link.textContent = agent.title;
    title.append(link);
    const description = document.createElement('p');
    description.textContent = agent.description;
    card.append(title, description);
    document.getElementById('agents').append(card);
  }
  document.getElementById('status').textContent = '';
} catch { document.getElementById('status').textContent = 'Agent 목록을 불러오지 못했습니다. 서버 연결과 사이트 로그인 상태를 확인해 주세요.'; }
