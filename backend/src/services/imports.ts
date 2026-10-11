import { parse } from "csv-parse/sync";
import { questionSchema, type QuestionInput } from "@algodeck/shared";
export function parseImport(
  format: "csv" | "json",
  content: string,
): { questions: QuestionInput[]; errors: { row: number; message: string }[] } {
  const questions: QuestionInput[] = [];
  const errors: { row: number; message: string }[] = [];
  if (Buffer.byteLength(content) > 1_000_000)
    return { questions, errors: [{ row: 0, message: "Import exceeds 1 MB." }] };
  try {
    let rows: unknown;
    if (format === "csv")
      rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
        max_record_size: 50000,
      });
    else {
      const parsed: unknown = JSON.parse(content);
      rows =
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        "questions" in parsed
          ? parsed.questions
          : parsed;
    }
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000)
      return {
        questions,
        errors: [{ row: 0, message: "Provide between 1 and 1,000 questions." }],
      };
    rows.forEach((row, i) => {
      const result = questionSchema.safeParse(row);
      if (result.success) questions.push(result.data);
      else
        errors.push({
          row: i + 1,
          message: result.error.issues
            .map((e) => `${e.path.join(".") || "row"}: ${e.message}`)
            .join("; "),
        });
    });
  } catch {
    return {
      questions,
      errors: [
        {
          row: 0,
          message: `Invalid ${format.toUpperCase()}. Check quoting, headers and structure.`,
        },
      ],
    };
  }
  return { questions, errors };
}
