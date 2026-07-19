import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NewApplication from "./pages/NewApplication";
import ApplicationDetail from "./pages/ApplicationDetail";
import EditApplication from "./pages/EditApplication";
import { useI18n } from "./i18n";

export default function App() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">C</span>
          ComposeHub
        </Link>
        <nav>
          <Link to="/">{t("nav.dashboard")}</Link>
          <Link to="/applications/new">{t("nav.newApplication")}</Link>
        </nav>
        <label className="language-switcher">
          <span>{t("language.label")}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value as "vi" | "en")}>
            <option value="vi">VI</option>
            <option value="en">EN</option>
          </select>
        </label>
        <div className="sidebar-note">
          Docker Compose
          <br />
          Application Control Plane
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/applications/new" element={<NewApplication />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
          <Route path="/applications/:id/edit" element={<EditApplication />} />
        </Routes>
      </main>
    </div>
  );
}
