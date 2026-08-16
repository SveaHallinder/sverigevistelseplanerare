export const LEGAL_SOURCES = {
  incomeTaxAct: {
    title: "Inkomstskattelagen, 3 kap. 3 och 7 §§",
    url: "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/",
    reviewedAt: "2026-08-16"
  },
  movedFromSweden: {
    title: "Skatteverket: Har du flyttat från Sverige?",
    url: "https://www.skatteverket.se/privat/internationellt/bosattutomlands/harduflyttatfransverige.4.7459477810df5bccdd4800030036.html",
    reviewedAt: "2026-08-16"
  },
  permanentStay: {
    title: "Skatteverket: Stadigvarande vistelse i Sverige",
    url: "https://www4.skatteverket.se/rattsligvagledning/edition/2026.7/2637.html",
    reviewedAt: "2026-08-16"
  },
  taxTreatyResidence: {
    title: "Skatteverket: Artikel 4 och skatteavtalshemvist",
    url: "https://www4.skatteverket.se/rattsligvagledning/edition/2026.5/2970.html",
    reviewedAt: "2026-08-16"
  },
  sink183: {
    title: "Skatteverket: 183-dagarsregeln i SINK",
    url: "https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/sink/sink/vadar183dagarsregelnisinkochvadinnebarden.5.5b35a6251761e6914206793.html",
    reviewedAt: "2026-08-16"
  }
};

export const CHECKLIST_CONTENT = {
  yearRoundHome: {
    label: "Har du en bostad i Sverige som är inrättad för åretruntbruk?",
    sourceId: "movedFromSweden"
  },
  spouseOrMinorChildren: {
    label: "Har du make, maka eller minderåriga barn kvar i Sverige?",
    sourceId: "movedFromSweden"
  },
  businessInSweden: {
    label: "Bedriver du näringsverksamhet i Sverige?",
    sourceId: "incomeTaxAct"
  },
  businessInfluence: {
    label: "Har du tillgångar som kan ge väsentligt inflytande i svensk näringsverksamhet?",
    sourceId: "incomeTaxAct"
  },
  propertyInSweden: {
    label: "Har du fastighet i Sverige?",
    sourceId: "incomeTaxAct"
  },
  otherStrongTies: {
    label: "Har du andra starka personliga eller ekonomiska band till Sverige?",
    sourceId: "movedFromSweden"
  },
  workDuringStays: {
    label: "Arbetar du under dina vistelser i Sverige?",
    sourceId: "sink183"
  }
};
