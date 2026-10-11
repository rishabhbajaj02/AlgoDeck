import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute, AuthContext } from "../features/auth/AuthProvider";
import { CollectionForm } from "../features/collections/CollectionForm";
import { ImportDialog } from "../features/questions/ImportDialog";
import { PracticePage } from "../features/practice/PracticePage";
import { AuthPage } from "../features/auth/AuthPage";
import { supabase } from "../lib/supabase";
import { State } from "../components/ui";
import { api } from "../services/api";
import { AuthError } from "@supabase/supabase-js";
vi.mock("../lib/supabase", () => ({
  configured: true,
  supabase: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn() } },
}));
vi.mock("../services/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/api")>()),
  api: vi.fn(),
  timezone: "America/Toronto",
}));
function wrap(children: React.ReactNode, path = "/") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("practice workspace", () => {
  it("validates login, reports authentication errors and shows registration confirmation", async () => {
    vi.mocked(supabase!.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthError("Invalid login credentials"),
    });
    vi.mocked(supabase!.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    wrap(
      <AuthContext.Provider
        value={{ session: null, loading: false, configured: true }}
      >
        <AuthPage />
      </AuthContext.Provider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(supabase!.auth.signInWithPassword).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Email"), "learner@example.test");
    await user.type(screen.getByLabelText("Password"), "test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Invalid login credentials");
    expect(supabase!.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "learner@example.test",
      password: "test-password",
    });
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByText(
      "Check your email to confirm your account, then sign in.",
    );
    expect(supabase!.auth.signUp).toHaveBeenCalled();
  });
  it("protects private pages while signed out", async () => {
    wrap(
      <AuthContext.Provider
        value={{ session: null, loading: false, configured: true }}
      >
        <Routes>
          <Route
            path="/private"
            element={
              <ProtectedRoute>
                <div>Private content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<div>Login page</div>} />
        </Routes>
      </AuthContext.Provider>,
      "/private",
    );
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });
  it("validates collection creation and saves configured targets", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    wrap(<CollectionForm onSave={save} pending={false} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create collection" }));
    expect(save).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Collection name"), "French");
    await user.clear(screen.getByLabelText("Daily target"));
    await user.type(screen.getByLabelText("Daily target"), "8");
    await user.click(screen.getByRole("button", { name: "Create collection" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "French", daily_target: 8 }),
      ),
    );
  });
  it("keeps invalid JSON imports local and reports row-level server errors", async () => {
    wrap(<ImportDialog collectionId="c" open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Import format"), "json");
    await user.type(screen.getByLabelText("Question data"), "not json");
    await user.click(screen.getByRole("button", { name: "Import questions" }));
    expect(await screen.findByText(/valid JSON/i)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
  it("navigates questions and persists a rating before advancing", async () => {
    const session = {
      id: "s",
      collection_id: "c",
      session_date: "2026-10-11",
      status: "active",
      target_question_count: 2,
      available_count: 2,
      explanation: null,
      questions: [
        {
          id: "sq1",
          question_id: "q1",
          position: 0,
          status: "pending",
          rating: null as "easy" | null,
          question: {
            id: "q1",
            title: "Bonjour",
            content: "Translate",
            metadata: { hint: "A greeting" },
            source_url: null,
          },
        },
        {
          id: "sq2",
          question_id: "q2",
          position: 1,
          status: "pending",
          rating: null as "easy" | null,
          question: {
            id: "q2",
            title: "Gracias",
            content: "Translate",
            metadata: {},
            source_url: null,
          },
        },
      ],
    };
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (options?.method === "POST") {
        session.questions[0].status = "completed";
        session.questions[0].rating = "easy";
        return { id: "attempt" };
      }
      return structuredClone(session);
    });
    wrap(
      <Routes>
        <Route path="/app/practice/:sessionId" element={<PracticePage />} />
      </Routes>,
      "/app/practice/s",
    );
    const user = userEvent.setup();
    expect(
      await screen.findByRole("heading", { name: "Bonjour" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(
      screen.getByRole("heading", { name: "Gracias" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous question" }));
    await user.click(screen.getByRole("button", { name: /Easy/ }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/sessions/s/questions/q1/rate",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({ rating: "easy" }),
        }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Gracias" }),
    ).toBeInTheDocument();
  });
  it("renders actionable empty and error states", () => {
    wrap(<State empty message="Add your first question." />);
    expect(screen.getByText("Add your first question.")).toBeInTheDocument();
  });
  it("freezes uncertain rating retries and recovers a committed rating after a lost response", async () => {
    const session = {
      id: "s",
      collection_id: "c",
      session_date: "2026-10-11",
      status: "active",
      explanation: null,
      questions: [
        {
          id: "sq",
          question_id: "q",
          status: "pending",
          rating: null as string | null,
          question: { title: "Recovery", content: "Try it", metadata: {} },
        },
      ],
    };
    const submissions: unknown[] = [];
    vi.mocked(api).mockImplementation(async (_path, options) => {
      if (options?.method === "POST") {
        submissions.push(structuredClone(options.body));
        if (submissions.length === 2) {
          session.questions[0].status = "completed";
          session.questions[0].rating = "easy";
        }
        throw new Error("Connection interrupted");
      }
      return structuredClone(session);
    });
    wrap(
      <Routes>
        <Route path="/app/practice/:sessionId" element={<PracticePage />} />
      </Routes>,
      "/app/practice/s",
    );
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Recovery" });
    await user.clear(screen.getByLabelText("Time spent in seconds"));
    await user.type(screen.getByLabelText("Time spent in seconds"), "37");
    await user.type(screen.getByRole("textbox"), "A saved note");
    await user.click(screen.getByRole("button", { name: /Easy/ }));
    await screen.findByText("Connection interrupted");
    expect(screen.getByLabelText("Time spent in seconds")).toBeDisabled();
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start timer" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Easy/ }));
    await screen.findByRole("button", { name: "Finish session" });
    expect(submissions).toEqual([
      { rating: "easy", time_spent_seconds: 37, notes: "A saved note" },
      { rating: "easy", time_spent_seconds: 37, notes: "A saved note" },
    ]);
  });
});
