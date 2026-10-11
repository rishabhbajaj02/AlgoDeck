import { Routes, Route, Link } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "../features/auth/AuthProvider";
import { LandingPage } from "../features/auth/LandingPage";
import { Layout } from "./Layout";
import { State } from "../components/ui";
const AuthPage=lazy(()=>import('../features/auth/AuthPage').then(m=>({default:m.AuthPage})));
const DashboardPage=lazy(()=>import('../features/dashboard/DashboardPage').then(m=>({default:m.DashboardPage})));
const CollectionsPage=lazy(()=>import('../features/collections/CollectionsPage').then(m=>({default:m.CollectionsPage})));
const CollectionPage=lazy(()=>import('../features/collections/CollectionPage').then(m=>({default:m.CollectionPage})));
const PracticePage=lazy(()=>import('../features/practice/PracticePage').then(m=>({default:m.PracticePage})));
const RevisionPage=lazy(()=>import('../features/revision/RevisionPage').then(m=>({default:m.RevisionPage})));
const AnalyticsPage=lazy(()=>import('../features/analytics/AnalyticsPage').then(m=>({default:m.AnalyticsPage})));
export function App() {
  return (
    <Suspense fallback={<State loading/>}><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="collections/:id" element={<CollectionPage />} />
        <Route path="practice/:sessionId" element={<PracticePage />} />
        <Route path="revision" element={<RevisionPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>
      <Route
        path="*"
        element={
          <State
            empty
            message="This page doesn’t exist."
            action={
              <Link className="button button-primary" to="/app">
                Open workspace
              </Link>
            }
          />
        }
      />
    </Routes></Suspense>
  );
}
