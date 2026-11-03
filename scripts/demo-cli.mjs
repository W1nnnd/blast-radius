/** Offline fixture reports for terminal demos and video narration. */
import { createFixtureAdapter } from '../src/graph/fixtureAdapter.js';
import { createService } from '../src/service.js';
const argumentsList = process.argv.slice(2);
const textMode = argumentsList.includes('--text');
const [command, projectOrIssue, version] = argumentsList.filter(argument => argument !== '--text');
const service = createService(createFixtureAdapter());
let report;
if (command === 'release') {
  report = await service.analyzeRelease(projectOrIssue ?? 'PAY', version ?? '2.4.0');
} else if (command === 'issue') {
  report = await service.analyzeIssue(projectOrIssue ?? 'PAY-1');
} else {
  console.error('Usage: demo-cli.mjs release PAY 2.4.0 | issue PAY-1 [--text]');
  process.exitCode = 1;
}
if (report) {
  if (!textMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Demo data — ${report.subject.name}`);
    console.log(`${report.verdict} · ${report.risk.score}/100 · ${report.risk.confidence} confidence`);
    console.log(report.risk.summary);
    console.log('\nTop risks');
    for (const signal of report.topRisks) {
      console.log(`- ${signal.title}`);
    }
    console.log('\nChecklist');
    for (const item of report.checklist) {
      console.log(`- [ ] ${item.priority}: ${item.text}`);
    }
    console.log('\nExperts');
    for (const expert of report.experts) {
      console.log(`- ${expert.person.name}: ${expert.reasons.join('; ')}`);
    }
  }
}
