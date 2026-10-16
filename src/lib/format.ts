/** Minimum bid as shown in CGA: "-" for no minimum, else "$10.00". */
export const formatMin = (cents: number) => (cents ? `$${(cents / 100).toFixed(2)}` : '-');

/** Keeps what a user typed as a max bid if it is a dollar amount: "$30" and "30" become "30". */
export function cleanMax(input: string) {
  const s = input.replace(/[$,\s]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(s) ? s : '';
}

export const formatMax = (max: string | undefined) => (max ? `$${max}` : '');

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
