import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NewApplication from "./pages/NewApplication";
import ApplicationDetail from "./pages/ApplicationDetail";
import EditApplication from "./pages/EditApplication";

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">C</span>
          ComposeHub
        </Link>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/applications/new">Tạo Application</Link>
        </nav>
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
