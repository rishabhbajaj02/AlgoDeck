import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Layers } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";
import { Button, ErrorMessage } from "../../components/ui";
const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});
export function AuthPage() {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const auth = useAuth();
  const location = useLocation();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  const from =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/app")
      ? location.state.from
      : "/app";
  if (auth.session) return <Navigate to={from} replace />;
  const submit = form.handleSubmit(async (input) => {
    setError(null);
    setNotice("");
    if (!supabase) {
      setError(
        new Error(
          "Add your project URL and public key to frontend/.env, then restart Vite.",
        ),
      );
      return;
    }
    const { data, error } = register
      ? await supabase.auth.signUp({
          ...input,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        })
      : await supabase.auth.signInWithPassword(input);
    if (error) setError(error);
    else if (register && !data.session)
      setNotice("Check your email to confirm your account, then sign in.");
  });
  return (
    <div className="auth-page">
      <Link to="/" className="brand">
        <Layers size={25} /> AlgoDeck
      </Link>
      <div className="auth-layout">
        <div className="auth-story">
          <h1>
            A little practice.
            <br />A lasting difference.
          </h1>
          <p>Your questions. Your pace. A smarter way to remember.</p>
          <div className="study-card">
            <span>Build a habit that stays with you</span>
            <h2>What will you learn today?</h2>
            <p>
              Algorithms, a new language, your next interview.
              <br />
              Make room for five questions.
            </p>
            <div className="card-tabs">
              <span>Practice</span>
              <span>Reflect</span>
              <span>Remember</span>
            </div>
          </div>
        </div>
        <section className="auth-form panel">
          <h2>{register ? "Start your practice" : "Welcome back"}</h2>
          <p className="muted">
            {register
              ? "Create your free study workspace."
              : "Pick up where you left off."}
          </p>
          {!auth.configured && (
            <div className="notice">
              Configure frontend/.env using the included example to enable
              sign-in.
            </div>
          )}
          <form onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                {...form.register("email")}
              />
            </label>
            {form.formState.errors.email && (
              <span className="field-error">
                {form.formState.errors.email.message}
              </span>
            )}
            <label>
              Password
              <input
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                {...form.register("password")}
              />
            </label>
            {form.formState.errors.password && (
              <span className="field-error">
                {form.formState.errors.password.message}
              </span>
            )}
            <ErrorMessage error={error} />
            {notice && (
              <div className="notice" role="status">
                {notice}
              </div>
            )}
            <Button
              disabled={form.formState.isSubmitting || !auth.configured}
              type="submit"
            >
              {form.formState.isSubmitting
                ? "Please wait…"
                : register
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to AlgoDeck?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
                setError(null);
                setNotice("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
        </section>
      </div>
    </div>
  );
}
