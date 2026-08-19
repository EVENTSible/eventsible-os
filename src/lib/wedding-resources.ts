export type WeddingResourceField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "checklist";
  placeholder?: string;
  options?: string[];
};

export type WeddingResourceTable = {
  key: string;
  columns: string[];
  rowCount?: number;
  rowLabels?: string[];
};

export type WeddingResourceSection = {
  title: string;
  description?: string;
  fields?: WeddingResourceField[];
  table?: WeddingResourceTable;
  tips?: string[];
};

export type WeddingResource = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  category: "Plan" | "Organize" | "Personalize" | "Celebrate";
  badge: string;
  sections: WeddingResourceSection[];
  guestbook?: boolean;
};

const firstDanceIdeas = [
  "At Last - Etta James",
  "Can't Help Falling in Love - Elvis Presley",
  "All of Me - John Legend",
  "A Thousand Years - Christina Perri",
  "You Are the Best Thing - Ray LaMontagne",
  "Lover - Taylor Swift",
];

export const WEDDING_RESOURCES: WeddingResource[] = [
  {
    slug: "meeting-companion",
    title: "Wedding Planning Meeting Companion",
    shortTitle: "Meeting Companion",
    description: "A guided agenda for phone calls and in-person meetings so the couple, planner, and EVENTSible cover the big decisions and the easy-to-miss details.",
    icon: "✦",
    category: "Plan",
    badge: "Start here",
    sections: [
      {
        title: "Wedding at a glance",
        fields: [
          { key: "couple", label: "Couple's names" },
          { key: "date", label: "Wedding date" },
          { key: "guest_count", label: "Estimated guest count" },
          { key: "ceremony_venue", label: "Ceremony venue and address" },
          { key: "reception_venue", label: "Reception venue and address" },
          { key: "vision", label: "How should the day feel?", type: "textarea", placeholder: "Elegant, relaxed, energetic, family-focused..." },
          { key: "priorities", label: "The couple's three biggest priorities", type: "textarea" },
        ],
      },
      {
        title: "People and communication",
        description: "Confirm who can make decisions and who should receive updates.",
        fields: [
          { key: "primary_contact", label: "Primary planning contact" },
          { key: "day_of_contact", label: "Day-of contact and phone" },
          { key: "planner", label: "Planner or coordinator" },
          { key: "venue_contact", label: "Venue contact" },
          { key: "photo_video", label: "Photographer and videographer" },
          { key: "other_vendors", label: "Other vendors we should coordinate with", type: "textarea" },
        ],
      },
      {
        title: "Ceremony walkthrough",
        fields: [
          { key: "ceremony_times", label: "Guest arrival, ceremony start, and expected end" },
          { key: "officiant", label: "Officiant and microphone needs" },
          { key: "processional", label: "Processional order, names, and pronunciations", type: "textarea" },
          { key: "ceremony_music", label: "Processional, special moment, and recessional songs", type: "textarea" },
          { key: "ceremony_elements", label: "Readings, unity ceremony, memorials, or special traditions", type: "textarea" },
          { key: "ceremony_backup", label: "Outdoor weather backup and decision deadline", type: "textarea" },
        ],
      },
      {
        title: "Reception flow",
        fields: [
          { key: "cocktail", label: "Cocktail hour timing, location, and music direction", type: "textarea" },
          { key: "introductions", label: "Wedding-party introduction order and pronunciations", type: "textarea" },
          { key: "formalities", label: "Grand entrance, first dance, blessing, welcome, toasts, cake, and parent dances", type: "textarea" },
          { key: "meal", label: "Meal style, table release, and vendor meal timing", type: "textarea" },
          { key: "traditions", label: "Bouquet, garter, anniversary dance, cultural traditions, or surprises", type: "textarea" },
          { key: "ending", label: "Last dance, private dance, grand exit, and end time", type: "textarea" },
        ],
      },
      {
        title: "Music and guest experience",
        fields: [
          { key: "must_plays", label: "Must-play songs and artists", type: "textarea" },
          { key: "do_not_play", label: "Do-not-play songs and artists", type: "textarea" },
          { key: "requests", label: "Guest-request rules" },
          { key: "clean_music", label: "Clean-edit expectations" },
          { key: "genres", label: "Favorite genres, eras, cultures, and energy changes", type: "textarea" },
          { key: "dedications", label: "Dedications, memorial songs, surprises, or sensitive notes", type: "textarea" },
        ],
      },
      {
        title: "Venue and production check",
        fields: [
          { key: "access", label: "Access and setup time" },
          { key: "load_in", label: "Parking, loading, stairs, elevators, and setup locations", type: "textarea" },
          { key: "power", label: "Power, Wi-Fi, ceremony audio, and microphone needs", type: "textarea" },
          { key: "restrictions", label: "Noise limits, curfew, fog restrictions, and venue rules", type: "textarea" },
          { key: "services", label: "DJ, photo booth, lighting, karaoke, screens, games, or other booked services", type: "textarea" },
        ],
      },
      {
        title: "Decisions and follow-up",
        fields: [
          { key: "decided", label: "Decisions made during this meeting", type: "textarea" },
          { key: "open_questions", label: "Open questions", type: "textarea" },
          { key: "couple_tasks", label: "Couple or planner follow-up, owner, and due date", type: "textarea" },
          { key: "eventsible_tasks", label: "EVENTSible follow-up, owner, and due date", type: "textarea" },
          { key: "next_checkin", label: "Next check-in date and final deadline" },
        ],
      },
    ],
  },
  {
    slug: "budget-tracker",
    title: "Wedding Budget Tracker",
    shortTitle: "Budget Tracker",
    description: "Compare estimates, actual costs, deposits, due dates, and balances without letting the tiny expenses form a financial boy band.",
    icon: "$",
    category: "Organize",
    badge: "Printable tracker",
    sections: [
      {
        title: "Budget snapshot",
        fields: [
          { key: "target", label: "Target wedding budget" },
          { key: "spent", label: "Amount committed so far" },
          { key: "paid", label: "Amount paid so far" },
          { key: "remaining", label: "Estimated remaining budget" },
          { key: "buffer", label: "Emergency or surprise-cost buffer" },
        ],
      },
      {
        title: "Expense tracker",
        table: {
          key: "budget",
          columns: ["Category", "Estimated", "Actual", "Paid", "Balance", "Due date", "Notes"],
          rowLabels: ["Venue", "Catering", "DJ / entertainment", "Photo / video", "Planner", "Decor / flowers", "Attire", "Beauty", "Cake / dessert", "Invitations", "Transportation", "Rentals", "Photo booth", "Ceremony", "Favors", "Lodging", "Tips", "Other"],
        },
      },
    ],
  },
  {
    slug: "master-guest-list",
    title: "Master Wedding Guest List",
    shortTitle: "Master Guest List",
    description: "Track invitations, RSVPs, meals, tables, contact details, gifts, and thank-you notes in one master list.",
    icon: "◎",
    category: "Organize",
    badge: "25-row worksheet",
    sections: [
      {
        title: "Guest totals",
        fields: [
          { key: "invited", label: "Total invited" },
          { key: "accepted", label: "Accepted" },
          { key: "declined", label: "Declined" },
          { key: "pending", label: "Awaiting reply" },
          { key: "children", label: "Children included" },
        ],
      },
      {
        title: "Guest list",
        table: { key: "guests", columns: ["Guest / household", "Phone or email", "Invited", "RSVP", "Meal", "Table", "Gift / thank-you"], rowCount: 25 },
      },
    ],
  },
  {
    slug: "vendor-tracker",
    title: "Wedding Vendor Details Tracker",
    shortTitle: "Vendor Tracker",
    description: "Keep every vendor contact, contract, payment, arrival time, and special instruction close enough to find when the timeline gets spicy.",
    icon: "⌂",
    category: "Organize",
    badge: "Contact + payment log",
    sections: [
      {
        title: "Primary coordination",
        fields: [
          { key: "decision_maker", label: "Final day-of decision maker" },
          { key: "master_timeline", label: "Who owns the master timeline?" },
          { key: "venue_rules", label: "Venue rules all vendors need", type: "textarea" },
        ],
      },
      {
        title: "Vendor directory",
        table: { key: "vendors", columns: ["Service", "Company / contact", "Phone / email", "Contract", "Deposit", "Balance / due", "Arrival", "Notes"], rowCount: 14 },
      },
    ],
  },
  {
    slug: "day-of-timeline",
    title: "Wedding Day Timeline Builder",
    shortTitle: "Day-of Timeline",
    description: "Build one readable timeline for the couple, wedding party, venue, vendors, and EVENTSible team.",
    icon: "◷",
    category: "Plan",
    badge: "Master timeline",
    sections: [
      {
        title: "Timeline anchors",
        fields: [
          { key: "ceremony", label: "Ceremony start" },
          { key: "cocktail", label: "Cocktail hour" },
          { key: "reception", label: "Reception start" },
          { key: "meal", label: "Meal service" },
          { key: "formalities", label: "Formal moments window" },
          { key: "end", label: "Last dance and venue clear-out" },
        ],
        tips: ["Work backward from the ceremony.", "Add travel and transition buffers.", "Assign one owner for every major cue.", "Share the final version with every vendor."],
      },
      {
        title: "Master day-of timeline",
        table: { key: "timeline", columns: ["Time", "Moment / task", "People", "Location", "Music / cue", "Owner", "Notes"], rowCount: 22 },
      },
    ],
  },
  {
    slug: "vow-builder",
    title: "Personalized Wedding Vow Builder",
    shortTitle: "Vow Builder",
    description: "Thoughtful prompts that help turn real memories and promises into vows that sound like an actual human wrote them.",
    icon: "♡",
    category: "Personalize",
    badge: "Writing guide",
    sections: [
      {
        title: "Find the heart of the story",
        fields: [
          { key: "first_impression", label: "What do you remember about the beginning?", type: "textarea" },
          { key: "admire", label: "What do you most admire about your partner?", type: "textarea" },
          { key: "memory", label: "A memory that captures your relationship", type: "textarea" },
          { key: "growth", label: "How has this relationship changed or strengthened you?", type: "textarea" },
          { key: "future", label: "What future are you excited to build together?", type: "textarea" },
        ],
      },
      {
        title: "Choose the promises",
        fields: [
          { key: "serious_promises", label: "Three serious promises", type: "textarea" },
          { key: "personal_promise", label: "One specific personal or playful promise", type: "textarea" },
          { key: "support", label: "How will you support your partner in hard seasons?", type: "textarea" },
        ],
      },
      {
        title: "Draft and polish",
        fields: [
          { key: "opening", label: "Opening", type: "textarea" },
          { key: "story", label: "Your story and what your partner means to you", type: "textarea" },
          { key: "promises", label: "Your promises", type: "textarea" },
          { key: "closing", label: "Closing line", type: "textarea" },
          { key: "review", label: "Final review", type: "checklist", options: ["Sounds like me", "Similar length to my partner's vows", "Comfortable sharing these details publicly", "Read aloud and timed", "Printed backup given to officiant or planner"] },
        ],
      },
    ],
  },
  {
    slug: "song-moment-guide",
    title: "Wedding Song and Moment Starter Guide",
    shortTitle: "Song Ideas",
    description: "A practical starting point for ceremony cues, entrances, special dances, formalities, and the final song of the night.",
    icon: "♫",
    category: "Personalize",
    badge: "Ideas + selections",
    sections: [
      {
        title: "Choose songs by feeling, not obligation",
        tips: ["Pick songs connected to a real memory when possible.", "Check lyrics before locking anything in.", "Tell the DJ which version, artist, or edit you want.", "Decide whether the DJ should play the full song or fade after a planned moment."],
        fields: [
          { key: "overall_sound", label: "How should the wedding sound overall?", type: "textarea" },
          { key: "meaningful_artists", label: "Artists, concerts, songs, or eras connected to your story", type: "textarea" },
        ],
      },
      {
        title: "Ceremony music",
        tips: ["Processional: Canon in D - Pachelbel", "Processional: Turning Page - Sleeping At Last", "Bride or couple entrance: A Thousand Years - Christina Perri", "Recessional: Signed, Sealed, Delivered - Stevie Wonder", "Recessional: This Will Be - Natalie Cole"],
        fields: [
          { key: "processional", label: "Wedding-party processional" },
          { key: "entrance", label: "Bride or couple processional" },
          { key: "ceremony_special", label: "Unity, memorial, or special ceremony music" },
          { key: "recessional", label: "Recessional" },
        ],
      },
      {
        title: "Reception entrances and dances",
        tips: ["Grand entrance: Bring 'Em Out - T.I.", "Grand entrance: On Top of the World - Imagine Dragons", ...firstDanceIdeas.map((song) => `First dance: ${song}`), "Parent dance: My Girl - The Temptations", "Parent dance: What a Wonderful World - Louis Armstrong"],
        fields: [
          { key: "party_entrance", label: "Wedding-party entrance" },
          { key: "couple_entrance", label: "Couple's grand entrance" },
          { key: "first_dance", label: "First dance" },
          { key: "parent_dances", label: "Parent and family dances", type: "textarea" },
        ],
      },
      {
        title: "Formal moments and finish",
        tips: ["Cake cutting: Sugar - Maroon 5", "Bouquet toss: Girls Just Want to Have Fun - Cyndi Lauper", "Anniversary dance: Through the Years - Kenny Rogers", "Last dance: Don't Stop Believin' - Journey", "Private last dance: Perfect - Ed Sheeran", "Grand exit: Firework - Katy Perry"],
        fields: [
          { key: "cake", label: "Cake cutting" },
          { key: "bouquet", label: "Bouquet or special tradition" },
          { key: "anniversary", label: "Anniversary dance" },
          { key: "last_dance", label: "Public last dance" },
          { key: "private_dance", label: "Private last dance" },
          { key: "exit", label: "Grand exit" },
        ],
      },
    ],
  },
  {
    slug: "guestbook",
    title: "Interactive Wedding Guestbook Starter",
    shortTitle: "Guestbook Starter",
    description: "Collect names, memories, advice, and messages on one device, then print the keepsake. Shared guest links and moderation are the next collaboration phase.",
    icon: "✎",
    category: "Celebrate",
    badge: "Device-based MVP",
    guestbook: true,
    sections: [],
  },
];

export function getWeddingResource(slug: string) {
  return WEDDING_RESOURCES.find((resource) => resource.slug === slug);
}

export const FEATURED_WEDDING_RESOURCES = WEDDING_RESOURCES.slice(0, 6);
