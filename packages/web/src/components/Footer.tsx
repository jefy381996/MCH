export function Footer({ isDemo }: { isDemo: boolean }) {
  return (
    <footer>
      <p>
        {isDemo ? 'Prices on this page are simulated demo data. ' : ''}MCH tokens are not offered
        for sale on this site. Nothing here is financial advice or an offer to buy or sell anything.
      </p>
      <p>
        The MCH Index is calculated by MCH from prices supplied by third parties. It is not an
        official price of the London Metal Exchange, the LBMA or any other market.
      </p>
      <p>© {new Date().getFullYear()} MCH</p>
    </footer>
  );
}
