export type StarterTaskEffort = 'small' | 'medium' | 'large';

export interface StarterTaskTemplateItem {
  key: string;
  title: string;
  description: string;
  effort: StarterTaskEffort;
}

export const STARTER_TASK_CONSTRAINTS = {
  minTitleLength: 5,
  maxTitleLength: 80,
  minDescriptionLength: 20,
  maxDescriptionLength: 300,
  minTemplatesPerCategory: 3,
  maxTemplatesPerCategory: 6,
} as const;

export const PROJECT_CATEGORIES = [
  'Web App',
  'Mobile App',
  'Data & AI',
  'Design',
  'Research',
  'Open Source',
  'Hardware',
  'Other',
  'General',
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

const CATEGORY_ALIASES: Record<string, ProjectCategory> = {
  'web app': 'Web App',
  web: 'Web App',
  webapp: 'Web App',
  'mobile app': 'Mobile App',
  mobile: 'Mobile App',
  mobileapp: 'Mobile App',
  'data & ai': 'Data & AI',
  'data and ai': 'Data & AI',
  data: 'Data & AI',
  ai: 'Data & AI',
  'machine learning': 'Data & AI',
  ml: 'Data & AI',
  design: 'Design',
  'ui/ux': 'Design',
  ui: 'Design',
  ux: 'Design',
  research: 'Research',
  'open source': 'Open Source',
  opensource: 'Open Source',
  oss: 'Open Source',
  hardware: 'Hardware',
  iot: 'Hardware',
  embedded: 'Hardware',
  other: 'Other',
  general: 'General',
};

export function normalizeProjectCategory(raw?: string | null): ProjectCategory {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!cleaned) return 'General';
  return CATEGORY_ALIASES[cleaned] || 'General';
}

export const STARTER_TASK_TEMPLATES: Record<ProjectCategory, StarterTaskTemplateItem[]> = {
  'Web App': [
    {
      key: 'web-repo-readme',
      title: 'Set up repository and README',
      description: 'Initialize the project repository, branch conventions, .env.example, and clear local setup instructions in README.md.',
      effort: 'small',
    },
    {
      key: 'web-main-screens',
      title: 'Design the main screens and routes',
      description: 'Create wireframes and component structure for the landing, navigation shell, and primary application views.',
      effort: 'medium',
    },
    {
      key: 'web-auth-flow',
      title: 'Build authentication and sign-in flow',
      description: 'Implement login, signup, protected route guards, and session state handling backed by API endpoints.',
      effort: 'large',
    },
    {
      key: 'web-first-tests',
      title: 'Write core unit and integration tests',
      description: 'Add automated smoke and regression tests covering primary user flows and critical API error states.',
      effort: 'medium',
    },
    {
      key: 'web-deploy-demo',
      title: 'Deploy an interactive staging demo',
      description: 'Configure build scripts and publish a working staging preview URL so reviewers and teammates can test features.',
      effort: 'medium',
    },
  ],
  'Mobile App': [
    {
      key: 'mob-repo-setup',
      title: 'Initialize mobile workspace and README',
      description: 'Set up the project folder structure, lint rules, environment config, and simulator run guide in README.md.',
      effort: 'small',
    },
    {
      key: 'mob-screen-navigation',
      title: 'Design core screens and tab navigation',
      description: 'Implement the app navigation stack, primary screen layouts, and responsive styling across screen sizes.',
      effort: 'medium',
    },
    {
      key: 'mob-api-offline-sync',
      title: 'Connect API client and local cache',
      description: 'Integrate REST endpoints with loading/error states and persist key session state cleanly on the device.',
      effort: 'large',
    },
    {
      key: 'mob-device-tests',
      title: 'Verify builds and run device tests',
      description: 'Write widget or UI smoke tests and confirm clean debug builds across Android or iOS emulators.',
      effort: 'medium',
    },
  ],
  'Data & AI': [
    {
      key: 'ai-repo-pipeline',
      title: 'Set up repository and data pipeline',
      description: 'Organize notebook/code directories, dependency manifest, dataset loading scripts, and reproducibility notes.',
      effort: 'small',
    },
    {
      key: 'ai-eda-metrics',
      title: 'Run exploratory analysis and clean dataset',
      description: 'Inspect schema, handle missing or noisy rows, and document baseline dataset statistics and splits.',
      effort: 'medium',
    },
    {
      key: 'ai-baseline-model',
      title: 'Train and evaluate baseline model',
      description: 'Implement an initial baseline model, log validation metrics, and compare against simple heuristics.',
      effort: 'large',
    },
    {
      key: 'ai-eval-report',
      title: 'Document metrics and inference endpoint',
      description: 'Package reproducible evaluation scripts, summarize model limitations, and expose a minimal inference wrapper.',
      effort: 'medium',
    },
  ],
  Design: [
    {
      key: 'des-tokens-kit',
      title: 'Define color, type, and spacing tokens',
      description: 'Establish shared typography scale, accessible color contrast palette, and reusable spacing tokens for UI.',
      effort: 'small',
    },
    {
      key: 'des-user-flows',
      title: 'Map user journeys and low-fi wireframes',
      description: 'Sketch end-to-end flows for primary user tasks including empty, loading, and error recovery states.',
      effort: 'medium',
    },
    {
      key: 'des-interactive-proto',
      title: 'Build clickable high-fidelity prototype',
      description: 'Assemble interactive screens with reusable components covering desktop and mobile responsive breakpoints.',
      effort: 'large',
    },
    {
      key: 'des-usability-handoff',
      title: 'Run usability review and dev handoff',
      description: 'Conduct peer review of interactive flows, verify accessibility contrast, and document implementation specs.',
      effort: 'medium',
    },
  ],
  Research: [
    {
      key: 'res-lit-review',
      title: 'Compile literature review and reading log',
      description: 'Summarize relevant papers, open benchmarks, and prior work into a structured shared reference table.',
      effort: 'small',
    },
    {
      key: 'res-methodology',
      title: 'Define research questions and methodology',
      description: 'Specify hypotheses, evaluation metrics, experiment protocol, and ethical or data validity checks.',
      effort: 'medium',
    },
    {
      key: 'res-initial-experiments',
      title: 'Run pilot experiments and capture outputs',
      description: 'Execute initial trials under controlled parameters and archive raw logs, scripts, and observed results.',
      effort: 'large',
    },
    {
      key: 'res-findings-summary',
      title: 'Draft findings report and next steps',
      description: 'Synthesize charts, statistical comparisons, and key takeaways for collaborators to review and extend.',
      effort: 'medium',
    },
  ],
  'Open Source': [
    {
      key: 'oss-repo-license',
      title: 'Set up repo, LICENSE, and CONTRIBUTING',
      description: 'Publish repository guidelines, open-source license, issue templates, and quickstart developer docs.',
      effort: 'small',
    },
    {
      key: 'oss-ci-checks',
      title: 'Configure CI linting and test workflow',
      description: 'Automate lint, build, and test verification on every pull request so community patches stay safe.',
      effort: 'medium',
    },
    {
      key: 'oss-starter-issues',
      title: 'Define good-first-issue milestone specs',
      description: 'Write clear acceptance criteria and reproduction steps for initial modular tasks open to contributors.',
      effort: 'medium',
    },
    {
      key: 'oss-minimal-example',
      title: 'Add runnable quickstart example',
      description: 'Create an end-to-end sample script or sandbox app proving installation and primary public API usage.',
      effort: 'small',
    },
  ],
  Hardware: [
    {
      key: 'hw-bom-schematic',
      title: 'Finalize bill of materials and schematic',
      description: 'List required sensors, microcontrollers, power budgets, and pin mappings before ordering parts.',
      effort: 'medium',
    },
    {
      key: 'hw-breadboard-proto',
      title: 'Assemble and test breadboard prototype',
      description: 'Wire core components on a bench breadboard and verify voltage rails and basic signal continuity.',
      effort: 'large',
    },
    {
      key: 'hw-firmware-drivers',
      title: 'Write initial firmware and telemetry logs',
      description: 'Implement device initialization, sensor polling loops, and serial/network telemetry output cleanly.',
      effort: 'large',
    },
    {
      key: 'hw-wiring-docs',
      title: 'Document wiring diagrams and safety notes',
      description: 'Publish pinout diagrams, calibration steps, and power safety guidelines in the project README.',
      effort: 'small',
    },
  ],
  Other: [
    {
      key: 'oth-scope-milestones',
      title: 'Define project scope and milestones',
      description: 'Outline deliverables, target deadlines, and team responsibilities so contributors understand priorities.',
      effort: 'small',
    },
    {
      key: 'oth-workspace-repo',
      title: 'Set up shared workspace and docs',
      description: 'Organize the shared repository, folder conventions, onboarding notes, and communication norms.',
      effort: 'small',
    },
    {
      key: 'oth-core-poc',
      title: 'Build initial working proof of concept',
      description: 'Implement the central workflow or deliverable slice to demonstrate feasibility for early feedback.',
      effort: 'large',
    },
    {
      key: 'oth-review-demo',
      title: 'Prepare review checklist and demo notes',
      description: 'Document verification steps, known limitations, and walkthrough notes for teammate review.',
      effort: 'medium',
    },
  ],
  General: [
    {
      key: 'gen-repo-readme',
      title: 'Set up project repository and README',
      description: 'Initialize version control, folder layout, and clear onboarding instructions for incoming collaborators.',
      effort: 'small',
    },
    {
      key: 'gen-milestone-plan',
      title: 'Outline milestone deliverables and goals',
      description: 'Break the roadmap into concrete deliverables with clear acceptance criteria and target dates.',
      effort: 'small',
    },
    {
      key: 'gen-core-slice',
      title: 'Implement core feature slice',
      description: 'Build and wire the primary end-to-end functionality so teammates can verify real behavior early.',
      effort: 'large',
    },
    {
      key: 'gen-tests-docs',
      title: 'Add verification tests and review notes',
      description: 'Write initial automated checks or test scenarios and update project documentation before review.',
      effort: 'medium',
    },
  ],
};
