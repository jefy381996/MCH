export type MilestoneStatus = 'done' | 'ready' | 'next' | 'later' | 'exploring';

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  done: 'Complete',
  ready: 'Ready',
  next: 'Next',
  later: 'Later',
  exploring: 'Exploring',
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
        'Exact whole-number arithmetic, shared by the backend, the website and the on-chain contract',
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
        'On-chain panel and a read-only wallet balance check',
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
        ? '100,000,000 MCH exist on Cardano, with a supply fixed for good.'
        : 'Ready to create: 100,000,000 MCH, with a supply fixed for good.',
      details: [
        'A Cardano native token following the CIP-68 standard',
        'Name, ticker and description readable by Cardano wallets',
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
      summary: 'Publishing the MCH Index on Cardano, where anyone can read and verify it.',
      details: [
        'An update whenever the index moves 0.5%, and at least every hour',
        'About 0.26 ADA per update',
      ],
    },
    {
      title: 'Legal review and security audit',
      status: 'next',
      summary: 'Independent checks before anyone outside the team can hold MCH.',
      details: [
        'Review by a UK solicitor experienced in cryptoassets and FCA rules',
        'An independent security audit of the contracts',
      ],
    },
    {
      title: 'Public launch',
      status: 'later',
      summary: 'Opening MCH to the public, once the legal and audit work is complete.',
      details: ['Only in the way the legal review allows'],
    },
    {
      title: 'Price-tracking design',
      status: 'exploring',
      summary: 'Options for making the coin’s market price follow the index.',
      details: [
        'A reserve-backed design, where coins can be redeemed at the index value',
        'A collateral-backed design, where users lock crypto collateral to create coins',
      ],
    },
  ];
}
