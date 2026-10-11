import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Analytics, Breakdown } from "@algodeck/shared";
import { useCollectionSelection } from "../../hooks/useCollectionSelection";
import { api, withTimezone } from "../../services/api";
import { PageHeading, State, shortDate, Badge } from "../../components/ui";
const colors = { easy: "#648e70", medium: "#bc914c", hard: "#b56b66" };
function BreakdownTable({ data, title }: { data: Breakdown[]; title: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {!data.length ? (
        <p className="muted">Complete a few questions to see a breakdown.</p>
      ) : (
        <div className="breakdown-list">
          {data.map((d) => (
            <div key={d.name}>
              <span>{d.name}</span>
              <div className="mini-progress">
                <span style={{ width: `${d.rate}%` }} />
              </div>
              <strong>{d.rate}%</strong>
              <small>
                {d.successes}/{d.attempts}
              </small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
export function AnalyticsPage() {
  const selection = useCollectionSelection();
  const query = useQuery({
    queryKey: ["analytics", selection.id],
    queryFn: () =>
      api<Analytics>(withTimezone(`/collections/${selection.id}/analytics`)),
    enabled: !!selection.id,
  });
  return (
    <>
      <PageHeading
        title="Progress, in perspective"
        description="See what’s becoming familiar and what deserves another visit."
      />
      {selection.collections.isPending ? (
        <State loading />
      ) : selection.collections.error ? (
        <State error={selection.collections.error} />
      ) : !selection.id ? (
        <State
          empty
          message="Create a collection and start practicing to see your progress."
          action={
            <Link className="button button-primary" to="/app/collections">
              Create collection
            </Link>
          }
        />
      ) : (
        <>
          <div className="toolbar">
            <select
              aria-label="Choose collection"
              value={selection.id}
              onChange={(e) => selection.setId(e.target.value)}
            >
              {selection.collections.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="muted">Your practice, over time</span>
          </div>
          {query.isPending ? (
            <State loading />
          ) : query.error ? (
            <State error={query.error} />
          ) : (
            query.data && (
              <>
                <div className="analytics-summary">
                  <div>
                    <strong>{query.data.attempt_count}</strong>
                    <span>Total attempts</span>
                  </div>
                  <div>
                    <strong>{query.data.success_rate}%</strong>
                    <span>Easy or medium ratings</span>
                  </div>
                  <div>
                    <strong>{query.data.hard_questions.length}</strong>
                    <span>Questions needing attention</span>
                  </div>
                </div>
                <div className="analytics-grid">
                  <section className="panel">
                    <h2>Completion trend</h2>
                    <p className="muted">The past 30 study days</p>
                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={query.data.trends}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e9e9e6"
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={shortDate}
                            minTickGap={35}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            width={25}
                            allowDecimals={false}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            labelFormatter={(v) => shortDate(String(v))}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            name="Attempts"
                            stroke="#4167b4"
                            fill="#dce5f7"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>How practice feels</h2>
                    <p className="muted">Ratings across all attempts</p>
                    {query.data.attempt_count ? (
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(query.data.ratings).map(
                                ([name, value]) => ({ name, value }),
                              )}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={65}
                              outerRadius={90}
                              paddingAngle={4}
                            >
                              {Object.keys(query.data.ratings).map((r) => (
                                <Cell
                                  key={r}
                                  fill={colors[r as keyof typeof colors]}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <State empty message="Your ratings will appear here." />
                    )}
                    <div className="chart-legend">
                      {Object.entries(query.data.ratings).map(
                        ([name, value]) => (
                          <span key={name}>
                            <i
                              style={{
                                background: colors[name as keyof typeof colors],
                              }}
                            />
                            {name}: {value}
                          </span>
                        ),
                      )}
                    </div>
                  </section>
                  <BreakdownTable
                    data={query.data.categories}
                    title="Success by category"
                  />
                  <BreakdownTable
                    data={query.data.patterns}
                    title="Success by pattern"
                  />
                  <section className="panel">
                    <h2>Upcoming revision workload</h2>
                    <p className="muted">
                      Currently scheduled reviews over the next 14 days
                    </p>
                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={query.data.workload}>
                          <XAxis
                            dataKey="date"
                            tickFormatter={shortDate}
                            minTickGap={25}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            width={25}
                            allowDecimals={false}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            labelFormatter={(v) => shortDate(String(v))}
                          />
                          <Bar
                            dataKey="count"
                            name="Due questions"
                            fill="#7b8e79"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Worth another visit</h2>
                    <p className="muted">
                      Questions rated hard at least twice in a row
                    </p>
                    {!query.data.hard_questions.length ? (
                      <State
                        empty
                        message="No repeated difficult ratings yet."
                      />
                    ) : (
                      query.data.hard_questions.map((q) => (
                        <div className="hard-row" key={q.id}>
                          <Link to={`/app/collections/${q.collection_id}`}>
                            {q.title}
                          </Link>
                          <Badge tone="hard">
                            {q.progress!.consecutive_difficult_ratings} hard
                            ratings
                          </Badge>
                        </div>
                      ))
                    )}
                  </section>
                </div>
                <p className="form-help analytics-footnote">
                  Success means an Easy or Medium rating. These intervals are
                  practical heuristics; your ratings guide the rhythm.
                </p>
              </>
            )
          )}
        </>
      )}
    </>
  );
}
