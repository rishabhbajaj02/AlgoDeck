import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Layers,
  Repeat2,
  CalendarDays,
  Check,
} from "lucide-react";
export function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/" className="brand">
          <Layers />
          AlgoDeck
        </Link>
        <Link to="/auth" className="button button-secondary">
          Sign in <ArrowUpRight size={16} />
        </Link>
      </nav>
      <main className="landing-hero">
        <div>
          <div className="landing-note">
            <span className="dot" /> A daily space for deliberate practice
          </div>
          <h1>
            Make room
            <br />
            for what
            <br />
            <em>you’re learning.</em>
          </h1>
          <p>
            Turn any question list into a practice habit. Revisit what’s
            difficult. Give what you know room to breathe.
          </p>
          <Link className="button button-primary" to="/auth">
            Start your practice <ArrowUpRight size={19} />
          </Link>
          <span className="landing-caption">
            Your questions. Five a day. Progress that adds up.
          </span>
        </div>
        <div
          className="landing-visual"
          aria-label="Practice, reflection and revision"
        >
          <div className="paper-back" />
          <article className="paper-card">
            <div className="paper-top">
              <Layers size={23} />
              <span>A moment to learn</span>
            </div>
            <div className="paper-rule" />
            <h2>
              Small steps.
              <br />
              Deeper understanding.
            </h2>
            <p>
              Recall it.
              <br />
              Work through it.
              <br />
              Make it yours.
            </p>
            <div className="paper-bottom">
              <span>
                <Check size={17} /> One question at a time
              </span>
              <Repeat2 size={23} />
            </div>
          </article>
          <div className="floating-note">
            <CalendarDays size={20} />
            <div>
              A rhythm that fits your day
              <small>Practice · Reflect · Repeat</small>
            </div>
          </div>
        </div>
      </main>
      <section className="landing-features">
        <div>
          <span>Bring your own questions</span>
          <p>
            Import a list or build a collection. Learn algorithms, languages, or
            anything in between.
          </p>
        </div>
        <div>
          <span>Review when it matters</span>
          <p>
            Your ratings shape the next session, with more room for the
            questions you find hard.
          </p>
        </div>
        <div>
          <span>See your progress</span>
          <p>
            Follow your practice over time and discover where a little attention
            goes a long way.
          </p>
        </div>
      </section>
      <footer>
        AlgoDeck <span>Make practice stick.</span>
      </footer>
    </div>
  );
}
