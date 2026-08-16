# QA på localhost

Kör `npm run dev` och öppna URL:en som servern skriver ut.

1. Starta med tom lagring. Verifiera disclaimer, demo och att omvänd period eller budget 0 blockeras med fältnära fel.
2. Spara period 2026-08-01 till 2026-08-31 och budget 5. Verifiera nollvärden och "Inga Sverigedagar registrerade".
3. Lägg faktisk 2026-08-01 till 2026-08-02 och planerad 2026-08-02 till 2026-08-06. Verifiera 2 faktiska, 5 planerade, 6 unika, 1 över budget, faktisk status 2 augusti och senaste inom budget 5 augusti.
4. Redigera den planerade vistelsen, bekräfta en passerad plan och radera en vistelse. Verifiera omräkning, bekräftelser och fokusretur.
5. Sätt svenskt medborgarskap till ja och ett anknytningssvar till ja. Verifiera konkret underlag, neutral copy, officiell länk och "senast granskad 2026-08-16".
6. Testa 375 px, 200 procent zoom och endast tangentbord. Verifiera roving focus, dialogfokus, status utan färg och "Rensa all data" tillbaka till onboarding.
