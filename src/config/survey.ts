// Kurze Umfrage zum Pop-up-Testlauf. Fragen und Antworten werden nur hier gepflegt; Formular,
// Validierung und Auswertung im Admin lesen daraus. IDs nicht umbenennen, sie stehen in der Datenbank.

export type SurveyQuestion = {
  id: string;
  label: string;
  labelEn: string;
  multiple: boolean;
  options: readonly { id: string; label: string; labelEn: string }[];
};

export const surveyQuestions = [
  {
    id: "days",
    label: "An welchen Tagen hättest du gern Lean's?",
    labelEn: "Which days would you like Lean's?",
    multiple: true,
    options: [
      { id: "mo", label: "Mo", labelEn: "Mon" },
      { id: "di", label: "Di", labelEn: "Tue" },
      { id: "mi", label: "Mi", labelEn: "Wed" },
      { id: "do", label: "Do", labelEn: "Thu" },
      { id: "fr", label: "Fr", labelEn: "Fri" },
      { id: "sa", label: "Sa", labelEn: "Sat" },
      { id: "so", label: "So", labelEn: "Sun" },
    ],
  },
  {
    id: "times",
    label: "Und wann am liebsten?",
    labelEn: "And what time suits you best?",
    multiple: true,
    options: [
      { id: "mittags", label: "Mittags", labelEn: "Lunchtime" },
      { id: "nachmittags", label: "Nachmittags", labelEn: "Afternoon" },
      { id: "abends", label: "Abends", labelEn: "Evening" },
    ],
  },
  {
    id: "frequency",
    label: "Wie oft würdest du bestellen?",
    labelEn: "How often would you order?",
    multiple: false,
    options: [
      { id: "weekly", label: "Jede Woche", labelEn: "Every week" },
      { id: "biweekly", label: "Alle zwei Wochen", labelEn: "Every two weeks" },
      { id: "sometimes", label: "Ab und zu", labelEn: "Now and then" },
      { id: "rarely", label: "Eher nicht", labelEn: "Probably not" },
    ],
  },
] as const satisfies readonly SurveyQuestion[];

export const surveyTipMaxLength = 1000;
