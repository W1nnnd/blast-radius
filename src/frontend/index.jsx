import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Heading, Lozenge, Stack } from '@forge/react';
import { invoke } from '@forge/bridge';

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => { invoke('getPanelData').then(setData).catch(() => setError(true)); }, []);
  if (error) return <Text>Unable to load graph context. Check access and the configured graph queries.</Text>;
  if (!data) return <Text>Loading release context…</Text>;
  return <Stack space="space.150">
    <Heading as="h2">Release risk: {data.risk.score}/100</Heading>
    <Lozenge appearance={{ low: 'success', medium: 'inprogress', high: 'removed' }[data.risk.level]}>{data.risk.level}</Lozenge>
    {data.empty && <Text>The graph returned no context for this issue.</Text>}
    <Text>{data.limitations}</Text>
    <Heading as="h3">Reasons</Heading>
    {data.risk.reasons.map((reason, i) => <Text key={i}>• {reason}</Text>)}
    <Heading as="h3">Pre-release checklist</Heading>
    {data.risk.checklist.map((task, i) => <Text key={i}>• {task}</Text>)}
    <Heading as="h3">Experts</Heading>
    {data.experts.length ? data.experts.map((expert, i) => <Text key={i}>{expert.name || expert.id}</Text>) : <Text>No experts returned by the graph.</Text>}
  </Stack>;
}
ForgeReconciler.render(<App />);
