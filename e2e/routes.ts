// Every page a shopper can open. The audit visits each at 1280 px and at 375 px wide.
export type Route = { name: string; path: string };

export const routes: Route[] = [
  { name: "home", path: "/" },
  { name: "sign in", path: "/signin" },
  { name: "delivery slots", path: "/slots" },
];

// Button verbs this shop uses beyond the shared list, in lower case.
export const extraButtonVerbs: string[] = ["apply", "sign", "reserve", "book", "download"];

// Strings the course pins on purpose. Specs and recorded runs assert them, so the audit skips them.
export const knownExceptions: string[] = [
  'Button "Add"', // release one name; release two renames it, and about 90 spec copies assert it
  'Button "Checkout"', // the triage step and its recorded output assert it
  'Error "Email or password is wrong."', // legacy specs and recordings assert it
];
