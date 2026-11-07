// Turns a twist card written in plain words into shock settings.
// Rule-based on purpose: instant, works offline during the live demo, and every match is shown
// back to the user ("Understood as ...") so nothing happens silently.

import { MONTHS, NO_SHOCK, type Shock } from "./engine";

export type Parsed = {
  accountId: number | null;
  shock: Shock;
  understood: string[];   // plain-language list of what was recognised
  empty: boolean;         // nothing recognised at all
};

const MONTH_WORDS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WORD_NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, half: 0.5, full: 1,
};

function num(s: string): number {
  const t = s.trim().toLowerCase();
  if (t in WORD_NUM) return WORD_NUM[t];
  return Number(t.replace(/,/g, ""));
}

export function parseScenario(text: string, startMonth = 1): Parsed {
  const t = " " + text.toLowerCase().replace(/[–—]/g, "-") + " ";
  const shock: Shock = { ...NO_SHOCK, startMonth };
  const understood: string[] = [];
  const N = "(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|full)";

  // ---- account id: "account 20111", "#20111", "customer 20111", or a bare 4-6 digit number
  let accountId: number | null = null;
  const acc = t.match(/(?:account(?:_id)?|acct|customer|client|id|#)\s*(?:no\.?|number)?\s*#?\s*(\d{4,6})\b/)
    ?? t.match(/(?<![$\d.,])\b(\d{4,6})\b(?!\s*(?:%|percent|months?|mo\b|weeks?|dollars|k\b))/);
  if (acc) accountId = Number(acc[1]);

  // ---- job loss / income drop
  const jobLoss = /(laid off|lay ?off|let go|lose[sd]? (?:their |his |her |a |the )?job|lost (?:their |his |her |a |the )?job|job loss|unemploy|fired|\bei\b|employment insurance)/.test(t);
  let incomePct: number | null = null;
  const eiPct = t.match(/\bei\b[^.%]{0,40}?(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:of (?:their |his |her )?(?:usual |normal |typical )?(?:income|pay|salary|earnings))/);
  const dropBy = t.match(/income[^.%]{0,25}?(?:drops?|falls?|cut|reduced|goes down|decreases?)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%/);
  const dropTo = t.match(/income[^.%]{0,25}?(?:drops?|falls?|cut|reduced|goes down)\s*to\s*(\d+(?:\.\d+)?)\s*%/);
  if (/no income|zero income|without (?:any )?income|no ei\b/.test(t)) incomePct = 0;
  else if (dropTo) incomePct = Number(dropTo[1]);
  else if (dropBy) incomePct = 100 - Number(dropBy[1]);
  else if (eiPct) incomePct = Number(eiPct[1] ?? eiPct[2]);
  else if (jobLoss) incomePct = 55;
  if (incomePct !== null) {
    shock.incomePct = Math.max(0, Math.min(100, incomePct));
    understood.push(jobLoss
      ? `Job loss: income drops to ${shock.incomePct}% of usual${!eiPct && !dropBy && !dropTo && incomePct === 55 ? " (EI default)" : ""}`
      : `Income drops to ${shock.incomePct}% of usual`);
  }

  // ---- how long the income drop lasts ("for 6 months", "for a year", "for 26 weeks")
  const dur = t.match(new RegExp(`for\\s+(?:the\\s+next\\s+)?${N}\\s*(months?|mo\\b|weeks?|years?)`))
    ?? t.match(new RegExp(`${N}\\s*(months?|weeks?)\\s+(?:of\\s+)?(?:ei|unemployment|without (?:a )?(?:job|work|income))`));
  if (dur && shock.incomePct < 100) {
    const n = num(dur[1]), unit = dur[2];
    const months = unit.startsWith("w") ? n / 4.345 : unit.startsWith("y") ? n * 12 : n;
    shock.duration = Math.max(1, Math.min(24, Math.round(months)));
    understood.push(`Lasts ${shock.duration} month${shock.duration === 1 ? "" : "s"}`);
  }

  // ---- household bills / rent increase ("bills go up 15%", "rent rises by 10%", "15% rent increase")
  const BILL = "(?:rent|bills?|household|utilit\\w*|hydro|heating|electricity|mortgage|housing)";
  const UP = "(?:up|increases?|increased|rises?|rose|goes up|go up|jumps?|climbs?|higher|more)";
  const bills = t.match(new RegExp(`${BILL}[^.%]{0,30}?${UP}[^.%\\d]{0,12}(\\d+(?:\\.\\d+)?)\\s*%`))
    ?? t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%\\s*${UP}?[^.%]{0,15}?${BILL}`));
  if (bills) {
    shock.billsPct = Math.max(0, Math.min(100, Number(bills[1])));
    understood.push(`Household bills / rent up ${shock.billsPct}%`);
  }

  // ---- one-off cost ("furnace dies", "repair costs a full month of their typical spending", "$5,000 car repair")
  const oneOffWords = /(furnace|repair|broke|breaks|dies|car\b|roof|emergency|surprise|unexpected|one-off|one off|medical|dental|vet\b|bill of)/.test(t);
  const monthsOf = t.match(new RegExp(`${N}\\s*(?:full\\s+)?months?\\s+(?:worth\\s+)?of\\s+(?:their\\s+|his\\s+|her\\s+)?(?:typical\\s+|usual\\s+|normal\\s+)?(?:spending|expenses)`));
  const dollars = t.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k\b)?|(\d[\d,]*(?:\.\d+)?)\s*(k\b|dollars)/);
  if (monthsOf) {
    shock.oneOffMonths = Math.min(3, num(monthsOf[1]));
    understood.push(`One-off cost: ${shock.oneOffMonths} month${shock.oneOffMonths === 1 ? "" : "s"} of typical spending`);
  } else if (dollars && oneOffWords) {
    const raw = dollars[1] ?? dollars[3];
    const k = (dollars[2] ?? dollars[4]) === "k";
    shock.oneOffDollars = Math.round(Number(raw.replace(/,/g, "")) * (k ? 1000 : 1));
    understood.push(`One-off cost: $${shock.oneOffDollars.toLocaleString("en-CA")}`);
  } else if (/furnace/.test(t)) {
    shock.oneOffMonths = 1;
    understood.push("One-off cost: furnace repair, 1 month of typical spending (twist-card default)");
  }

  // ---- when it starts ("in January", "starting December")
  const mon = t.match(/(?:in|starting|starts|from|during|this|next)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/);
  if (mon) {
    shock.startMonth = MONTH_WORDS.indexOf(mon[1].slice(0, 3)) + 1;
    understood.push(`Starts in ${MONTHS[shock.startMonth - 1]}`);
  }

  if (accountId !== null) understood.unshift(`Customer #${accountId}`);
  return { accountId, shock, understood, empty: understood.length === 0 };
}

export const EXAMPLE_SCENARIOS = [
  "This customer was laid off. EI pays 55% of their usual income for 6 months. Do they make it?",
  "The furnace dies, and the repair costs a full month of their typical spending.",
  "They lose their job (EI at 55%) and their household bills go up 15% in the same month.",
  "Rent goes up 25% starting in January.",
];
