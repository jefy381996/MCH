export type MilestoneStatus = 'done' | 'ready' | 'next';

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  done: 'Complete',
  ready: 'Ready',
  next: 'Next',
};

export interface Milestone {
  title: string;
  status: MilestoneStatus;
  summary: string;
  details: string[];
}

/** The roadmap, with the on-chain steps marked complete as soon as the chain shows them. */
export function milestones(chain: { coinExists: boolean; oracleLive: boolean }): Milestone[] {
  return [
    {
      title: 'Index methodology and price engine',
      status: 'done',
      summary: 'The MCH Index, calculated live from four metal prices.',
      details: [
        'Exact whole-number arithmetic, shared by the backend and the on-chain contract',
        'Checked against an independent reference implementation and 20,000 randomised cases',
        'A guard that keeps single bad price prints out of the index',
        'Price history storage and a live API',
      ],
    },
    {
      title: 'Website',
      status: 'done',
      summary: 'This site: the live index, its history, the basket and the methodology.',
      details: [
        'Live updates as prices move',
        'History charts for the index and for each metal',
        'On-chain panel, ready for when the oracle is live',
        'Works on phones, in light and dark mode',
      ],
    },
    {
      title: 'Smart contracts on Cardano',
      status: 'done',
      summary: 'The oracle and the MCH coin, written in Aiken and tested.',
      details: [
        'An oracle contract that recomputes the index and rejects any update that does not match',
        'Separate keys for routine updates and for administration',
        'A fixed-supply coin: it can be created once and never again',
        '221 contract tests, plus end-to-end tests on an emulated Cardano ledger',
      ],
    },
    {
      title: 'The MCH coin on Cardano',
      status: chain.coinExists ? 'done' : 'ready',
      summary: chain.coinExists
        ? 'The MCH coin exists on Cardano, with a fixed supply.'
        : 'Ready to create, with a planned fixed supply of 100,000,000 MCH.',
      details: [
        'A Cardano native token following the CIP-68 standard',
        'Name, ticker and description readable by wallets that support CIP-68',
        'No further coins can ever be created',
      ],
    },
    {
      title: 'Licensed market data',
      status: 'next',
      summary: 'Replacing the demonstration prices with licensed market prices.',
      details: [
        'Gold, silver and platinum from the London bullion markets',
        'Nickel from the London Metal Exchange',
        'Each source used under its data licence',
      ],
    },
    {
      title: 'Live on-chain index',
      status: chain.oracleLive ? 'done' : 'next',
      summary: chain.oracleLive
        ? 'The MCH Index is published on Cardano, where anyone can read and verify it.'
        : 'Publishing the MCH Index on Cardano, where anyone can read and verify it.',
      details: [
        'An update whenever the index moves 0.5%, and at least every hour',
        'About 0.26 ADA in network fees per update',
      ],
    },
    {
      title: 'Legal review and security audit',
      status: 'next',
      summary: 'Independent legal and security checks.',
      details: [
        'Review by a UK solicitor experienced in cryptoassets and FCA rules',
        'An independent security audit of the contracts',
      ],
    },
  ];
}
