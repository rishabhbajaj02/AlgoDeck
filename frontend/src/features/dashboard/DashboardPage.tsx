import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Play,
  CheckCheck,
  Repeat2,
  Flame,
  BookOpen,
  Plus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Dashboard, PracticeSession } from "@algodeck/shared";
import { api, timezone, withTimezone } from "../../services/api";
import { useAuth } from "../auth/AuthProvider";
import {
  Button,
  PageHeading,
  State,
  Badge,
  ProgressBar,
  ErrorMessage,
  shortDate,
} from "../../components/ui";
import { CollectionCard } from "../collections/CollectionsPage";
export function DashboardPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>(withTimezone("/dashboard")),
  });
  const start = useMutation({
    mutationFn: (id: string) =>
      api<PracticeSession>(`/collections/${id}/sessions`, {
        method: "POST",
        body: { timezone },
      }),
    onSuccess: (s) => {
      void cache.invalidateQueries();
      navigate(`/app/practice/${s.id}`);
    },
  });
  const name = auth.session?.user.email?.split("@")[0] ?? "learner";
  if (query.isPending) return <State loading />;
  if (query.error || !query.data)
    return (
      <>
        <PageHeading title="Your practice workspace" />
        <State
          error={query.error}
          action={<Button onClick={() => query.refetch()}>Try again</Button>}
        />
        <p className="setup-tip">
          If this is your first run, apply the migration in supabase/migrations
          to your Supabase project.
        </p>
      </>
    );
  const data = query.data;
  const target = data.collections.reduce((sum, c) => sum + c.daily_target, 0);
  return (
    <>
      <PageHeading
        title={`Good to see you, ${name}.`}
        description="A little focus today. A little more understanding tomorrow."
        actions={
          <Link className="button button-secondary" to="/app/collections">
            <Plus size={16} />
            New collection
          </Link>
        }
      />
      <div className="metric-grid">
        {[
          {
            label: "Completed today",
            value: data.completed_today,
            sub: `of ${target} planned questions`,
            icon: CheckCheck,
          },
          {
            label: "Ready for revision",
            value: data.due + data.overdue,
            sub: `${data.overdue} overdue · ${data.due} due today`,
            icon: Repeat2,
          },
          {
            label: "Current streak",
            value: `${data.streak} ${data.streak === 1 ? "day" : "days"}`,
            sub: "One practice at a time",
            icon: Flame,
          },
          {
            label: "New to explore",
            value: data.unseen,
            sub: "Unseen questions in your collections",
            icon: BookOpen,
          },
        ].map(({ label, value, sub, icon: Icon }) => (
          <div className="metric panel" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="today-panel panel">
          <div className="section-heading">
            <h2>Today’s practice</h2>
            <Badge tone="blue">Daily rhythm</Badge>
          </div>
          <p className="muted">Pick a collection and make a little progress.</p>
          <ErrorMessage error={start.error} />
          {!data.collections.length ? (
            <State
              empty
              message="Your practice starts with a collection."
              action={
                <Link className="button button-primary" to="/app/collections">
                  Create your first collection <ArrowUpRight size={17} />
                </Link>
              }
            />
          ) : (
            <div className="today-list">
              {data.collections.map((c) => {
                const s = data.sessions.find((s) => s.collection_id === c.id);
                const done =
                  s?.questions.filter((q) => q.status === "completed").length ??
                  0;
                return (
                  <article key={c.id}>
                    <div className="today-row">
                      <div>
                        <Link to={`/app/collections/${c.id}`}>
                          <h3>{c.name}</h3>
                        </Link>
                        <span>
                          {s
                            ? `${done} of ${s.questions.length} completed`
                            : `${c.daily_target} questions · up to ${c.new_question_limit} new`}
                        </span>
                      </div>
                      {s?.status === "completed" ? (
                        <Link
                          className="text-link"
                          to={`/app/practice/${s.id}`}
                        >
                          View summary <ArrowUpRight size={15} />
                        </Link>
                      ) : (
                        <Button
                          variant={s ? "secondary" : "primary"}
                          disabled={start.isPending}
                          onClick={() =>
                            s
                              ? navigate(`/app/practice/${s.id}`)
                              : start.mutate(c.id)
                          }
                        >
                          <Play size={14} />
                          {s ? "Resume" : "Start"}
                        </Button>
                      )}
                    </div>
                    <ProgressBar
                      value={done}
                      max={s?.questions.length ?? c.daily_target}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <section className="panel weekly-panel">
          <div className="section-heading">
            <h2>Your week</h2>
            <span className="muted">
              {data.weekly.reduce((n, d) => n + d.count, 0)} completed
            </span>
          </div>
          <p className="muted">Consistency comes in small steps.</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) =>
                    new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                    })
                  }
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  width={25}
                />
                <Tooltip
                  labelFormatter={(d) => shortDate(String(d))}
                  cursor={{ fill: "#f2f3f5" }}
                />
                <Bar
                  dataKey="count"
                  name="Completed"
                  fill="#4167b4"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={35}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="weekly-footer">
            <span className="dot" /> Each question is a step forward.
          </div>
        </section>
      </div>
      <div className="section-heading standalone">
        <h2>Your collections</h2>
        <Link className="text-link" to="/app/collections">
          View all <ArrowUpRight size={15} />
        </Link>
      </div>
      {data.collections.length ? (
        <div className="collection-grid">
          {data.collections.slice(0, 3).map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      ) : (
        <p className="muted">Keep each learning goal in its own collection.</p>
      )}
      <section className="panel activity-panel">
        <div className="section-heading">
          <h2>Recent practice</h2>
          <span className="muted">A record of your progress</span>
        </div>
        {!data.recent.length ? (
          <p className="muted">
            Complete a question to see your first activity here.
          </p>
        ) : (
          data.recent.map((a) => (
            <div key={a.id} className="activity-row">
              <div className="activity-dot" />
              <Link to={`/app/practice/${a.session_id}`}>{a.title}</Link>
              <Badge tone={a.rating}>{a.rating}</Badge>
              <span>{shortDate(a.attempted_at)}</span>
            </div>
          ))
        )}
      </section>
    </>
  );
}
