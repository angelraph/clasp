/** The FAQ, shared by the landing page preview and the full FAQ page. */
export type Faq = { q: string; a: string };
export type FaqGroup = { title: string; items: Faq[] };

export const FAQ: FaqGroup[] = [
  {
    title: "The basics",
    items: [
      {
        q: "What is Clasp?",
        a: "Clasp is a way to buy, sell or rent things from strangers without either side having to trust the other. The buyer's money is held by PayPal, not charged, and released to the seller only when the item in the buyer's hands is proven to be the item that was listed.",
      },
      {
        q: "How is this different from an escrow app?",
        a: "In a normal escrow app a person taps \"received\" and the money moves on their word. In Clasp the item itself releases the payment: the serial number or unique marks recorded when it was listed must match what the buyer scans at the handoff. A swapped, fake or locked device can't pass.",
      },
      {
        q: "What does it cost?",
        a: "Listing is free and sellers receive their full asking price. Buyers pay a small buyer protection fee (5%, minimum $1) on top, shown before they approve. If a deal is cancelled before the handoff, nothing is charged at all.",
      },
      {
        q: "Is this real money?",
        a: "Not yet. Clasp is a prototype running on the PayPal sandbox, PayPal's test environment. Every payment step is a real PayPal API call, but with test accounts and test money.",
      },
    ],
  },
  {
    title: "Buying",
    items: [
      {
        q: "When am I actually charged?",
        a: "Only when you tap Release at the meetup, after the item you're holding has matched the listing. Until then PayPal holds the amount on your account; it isn't sent to anyone.",
      },
      {
        q: "What if it's not the item that was listed?",
        a: "Clasp shows a mismatch, for example a different IMEI, and the money stays held. You can scan again or cancel, and cancelling releases the hold with nothing charged.",
      },
      {
        q: "What if the seller never shows up?",
        a: "Cancel the deal in your deal room and PayPal releases the hold. Even if you do nothing, an unused hold expires on its own within 29 days and nothing is captured.",
      },
      {
        q: "How do I avoid a fake IMEI screenshot?",
        a: "Check the device in your hands, not one the seller shows you. Dial *#06# on it yourself and scan that screen. For phones, Clasp also asks for the Find My or Find Hub screen showing the anti-theft lock is off, so you don't buy a locked device.",
      },
    ],
  },
  {
    title: "Selling",
    items: [
      {
        q: "When do I get paid?",
        a: "The moment the buyer's scan matches and they release the payment, Clasp captures it and sends your full price to your PayPal account. You'll get a notification when PayPal confirms the payout.",
      },
      {
        q: "Why the code on paper?",
        a: "It proves you physically have the item right now. Scammers list items they don't own using photos taken from elsewhere; a one-time code written by hand and photographed beside the item can't be faked that way.",
      },
      {
        q: "My item has no serial number. Can I still sell it?",
        a: "Yes. Clasp records marks unique to your exact item, like a scuff, a sticker or wear in a particular place, and the buyer's scan must show them. Add close-ups when you list.",
      },
      {
        q: "What if the buyer disputes the payment later?",
        a: "Clasp keeps a handoff record: your possession photo, the match result, the photos and the full PayPal timeline. If the buyer opens a PayPal dispute, Clasp sends that record to PayPal as evidence automatically.",
      },
    ],
  },
  {
    title: "Renting",
    items: [
      {
        q: "How do rental deposits work?",
        a: "The renter approves one PayPal hold for the fee plus the deposit. The fee is paid to the owner at pickup. At return, the owner scans the item back in, and the deposit is released apart from any charges from the agreed price list.",
      },
      {
        q: "Who decides what damage costs?",
        a: "The owner sets a price list before anyone pays, for example \"missing charger, $25\", and the renter sees it on the listing. The AI compares pickup and return photos and can flag anything, but only items on that list, seen with high confidence, can be charged. Everything else is shown as flagged, not charged.",
      },
      {
        q: "What if I disagree with a charge?",
        a: "Both sides see the same photos and the reason for each charge. Charges are capped at the deposit, and you keep your normal PayPal dispute rights; if you open one, the full record goes to PayPal.",
      },
    ],
  },
  {
    title: "AI, privacy and safety",
    items: [
      {
        q: "Can the AI take my money?",
        a: "No. The AI only reads photos and reports what it sees, with a confidence score. It never calls PayPal, never sees a price it could change, and isn't told which serial number to expect. Plain, tested rules decide every capture and release.",
      },
      {
        q: "Who can see my photos?",
        a: "Photos are private by default. Only shots the AI judges free of serial numbers, phone numbers, faces, documents and screens appear on the public listing. Everything else is visible only to the people in the deal.",
      },
      {
        q: "Does Clasp see my card or bank details?",
        a: "No. You pay inside PayPal. Clasp only receives the PayPal order and authorization, never your card, bank account or PayPal password.",
      },
      {
        q: "Can an AI shopping agent buy something for me?",
        a: "It can find verified listings and start a protected purchase, but it can't pay. It hands you a PayPal link, and only you can approve the hold. The seller is still paid only when the item checks out.",
      },
    ],
  },
];
