/** UI Kit issue panel: shared service reports rendered without a second scoring implementation. */
import React, {useEffect, useState} from 'react';
import ForgeReconciler, {
  Stack, Inline, Box, Heading, Text, Badge, Lozenge, ProgressBar, SectionMessage,
  DynamicTable, Link, Checkbox, Button, Tabs, TabList, Tab, TabPanel, Spinner, Strong
} from '@forge/react';
import {invoke} from '@forge/bridge';

const VERDICT_APPEARANCE = {
  HOLD: 'removed', GO_WITH_CAUTION: 'moved', GO: 'success', INSUFFICIENT_EVIDENCE: 'default'
};

function TopRisks({data}) {
  return (
    <Stack space="space.150">
      {data.topRisks.map(signal => (
        <Box key={signal.id}>
          <Text><Strong>{signal.title}</Strong> (+{signal.points})</Text>
          <Text>{signal.detail}</Text>
          {signal.evidence.map(entry => (
            <Text key={entry.id}>
              {/^https?:\/\//.test(entry.url ?? '')
                ? <Link href={entry.url}>{entry.label}</Link> : entry.label}
            </Text>
          ))}
        </Box>
      ))}
      {data.risk.categories.map(category => (
        <Box key={category.id}>
          <Text>{category.label}: {category.points}/{category.max}</Text>
          <ProgressBar ariaLabel={category.label} value={category.points / category.max}/>
        </Box>
      ))}
    </Stack>
  );
}

function Experts({experts}) {
  const head = {cells: [
    {key: 'name', content: 'Name'}, {key: 'why', content: 'Why'}, {key: 'team', content: 'Team'}
  ]};
  const rows = experts.map(expert => ({
    key: expert.person.accountId,
    cells: [
      {key: 'name', content: expert.person.name},
      {key: 'why', content: expert.reasons.join(' · ')},
      {key: 'team', content: expert.teams.join(', ')}
    ]
  }));
  return <DynamicTable head={head} rows={rows} emptyView="No experts observed"/>;
}

function Evidence({data}) {
  const sources = {...data.coverage.sources};
  for (const [name, source] of Object.entries(data.coverage)) {
    if (source && typeof source.available === 'boolean') sources[name] = source;
  }
  return (
    <Stack space="space.100">
      {Object.entries(data.counts).map(([name, count]) => (
        <Text key={name}>{name}: {count}</Text>
      ))}
      {Object.entries(sources).map(([name, source]) => (
        <Text key={name}>{name}: {source.available ? 'available' : source.reason}</Text>
      ))}
      <Text>Generated at {data.generatedAt}</Text>
      <Text>{data.disclaimer}</Text>
    </Stack>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState({});
  const [issueData, setIssueData] = useState(null);

  const load = async (name, payload) => {
    setLoading(true);
    setError(false);
    try {
      const result = await invoke(name, payload);
      if (result.error) setError(true);
      else {
        setData(result);
        setChecked({});
        if (name === 'getPanelData') setIssueData(result);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load('getPanelData'); }, []);

  if (error) return (
    <SectionMessage appearance="error">
      <Text>Unable to load analysis. Check access and data-source configuration.</Text>
      <Button onClick={() => load('getPanelData')}>Retry</Button>
    </SectionMessage>
  );
  if (!data || loading) return <Spinner label="Loading release evidence"/>;

  return (
    <Stack space="space.150">
      <Inline space="space.100">
        <Lozenge appearance={VERDICT_APPEARANCE[data.verdict]}>{data.verdict}</Lozenge>
        <Text><Strong>{data.risk.score}/100</Strong></Text>
        <Badge>{data.risk.confidence} confidence</Badge>
      </Inline>
      <Heading as="h2">{data.subject.name}</Heading>
      <Text>{data.risk.summary}</Text>
      {data.mode === 'fixture' && (
        <SectionMessage title="Demo data">
          <Text>Fictional Northwind Pay evidence, fixed at {data.generatedAt}.</Text>
        </SectionMessage>
      )}
      <Inline space="space.100">
        {data.subject.type === 'release' ? (
          <Button onClick={() => { setData(issueData); setChecked({}); }}>Back to issue</Button>
        ) : (data.releaseOptions ?? []).map(version => (
          <Button key={version.name} onClick={() => load('getReleaseData', {
            projectKey: version.projectKey, versionName: version.name
          })}>
            Analyze release {version.name}
          </Button>
        ))}
      </Inline>
      <Tabs id="blast-radius-tabs">
        <TabList><Tab>Top risks</Tab><Tab>Checklist</Tab><Tab>Experts</Tab><Tab>Evidence</Tab></TabList>
        <TabPanel><TopRisks data={data}/></TabPanel>
        <TabPanel>
          <Stack space="space.100">
            {data.checklist.map(item => (
              <Checkbox key={item.id} label={`${item.priority}: ${item.text}`}
                isChecked={!!checked[item.id]}
                onChange={() => setChecked(previous => ({...previous, [item.id]: !previous[item.id]}))}/>
            ))}
            <Text>Markdown checklist</Text>
            <Text>{data.checklist.map(item => `- [ ] ${item.priority}: ${item.text}`).join('\n')}</Text>
          </Stack>
        </TabPanel>
        <TabPanel><Experts experts={data.experts}/></TabPanel>
        <TabPanel><Evidence data={data}/></TabPanel>
      </Tabs>
    </Stack>
  );
}
ForgeReconciler.render(<App/>);
