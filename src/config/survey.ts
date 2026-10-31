// Kurze Umfrage zum Pop-up-Testlauf. Fragen und Antworten werden nur hier gepflegt; Formular,
// Validierung und Auswertung im Admin lesen daraus. IDs nicht umbenennen, sie stehen in der Datenbank.

export type SurveyQuestion = {
  id: string;
  label: string;
  multiple: boolean;
  options: readonly { id: string; label: string }[];
};

export const surveyQuestions = [
  {
    id: "days",
    label: "An welchen Tagen hättest du gern Lean's?",
    multiple: true,
    options: [
      { id: "mo", label: "Mo" },
      { id: "di", label: "Di" },
      { id: "mi", label: "Mi" },
      { id: "do", label: "Do" },
      { id: "fr", label: "Fr" },
      { id: "sa", label: "Sa" },
      { id: "so", label: "So" },
    ],
  },
  {
    id: "times",
    label: "Und wann am liebsten?",
    multiple: true,
    options: [
      { id: "mittags", label: "Mittags" },
      { id: "nachmittags", label: "Nachmittags" },
      { id: "abends", label: "Abends" },
    ],
  },
  {
    id: "frequency",
    label: "Wie oft würdest du bestellen?",
    multiple: false,
    options: [
      { id: "weekly", label: "Jede Woche" },
      { id: "biweekly", label: "Alle zwei Wochen" },
      { id: "sometimes", label: "Ab und zu" },
      { id: "rarely", label: "Eher nicht" },
    ],
  },
] as const satisfies readonly SurveyQuestion[];

export const surveyTipMaxLength = 1000;
